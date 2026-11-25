import { AppFileStatusKind, WorkingDirectoryFileChange } from '../models/status'

/**
 * Diff budgets (in characters) Kintsugi's Red alert tries in order when
 * asking Copilot for a commit message. Copilot rejects diffs that are too
 * long, so each failed attempt retries with a smaller, more summarized diff
 * instead of asking the user to shorten it by hand.
 */
export const RedAlertDiffBudgets: ReadonlyArray<number> = [
  48_000, 16_000, 6_000,
]

/** Files whose diffs are machine-written noise and never worth the budget. */
const NoisyFilePattern =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum|packages\.lock\.json)$|\.(min\.js|min\.css|map|snap)$/i

interface IDiffChunk {
  readonly path: string
  readonly text: string
}

const countChanges = (text: string) => {
  let added = 0
  let removed = 0
  for (const line of text.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added++
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed++
    }
  }
  return { added, removed }
}

/** The `diff --git …` header lines of a chunk, up to the first hunk. */
const chunkHeader = (text: string) => {
  const hunk = text.indexOf('\n@@')
  return hunk === -1 ? text : text.substring(0, hunk)
}

/** A chunk reduced to its header plus a one-line summary of what changed. */
const summarizeChunk = (chunk: IDiffChunk, reason: string) => {
  const { added, removed } = countChanges(chunk.text)
  return `${chunkHeader(
    chunk.text
  ).trimEnd()}\n(${reason}: +${added} -${removed} lines)\n`
}

/** Cut text to at most `max` characters on a line boundary. */
const truncateChunk = (chunk: IDiffChunk, max: number) => {
  if (chunk.text.length <= max) {
    return chunk.text
  }
  const cut = chunk.text.lastIndexOf('\n', max)
  const kept = chunk.text.substring(0, cut > 0 ? cut : max)
  const { added, removed } = countChanges(chunk.text.substring(kept.length))
  return `${kept}\n… (diff truncated: +${added} -${removed} more lines)\n`
}

/** Keep the first lines of `text` that fit in `max` characters. */
const truncateLines = (text: string, max: number) => {
  if (text.length <= max) {
    return text
  }
  const lines = text.split('\n')
  const kept = new Array<string>()
  let size = 0
  for (const line of lines) {
    if (size + line.length + 1 > max) {
      break
    }
    kept.push(line)
    size += line.length + 1
  }
  return `${kept.join('\n')}\n… and ${lines.length - kept.length} more lines\n`
}

/**
 * Shrink a `git diff --patch-with-raw` output to roughly `budget` characters
 * while keeping it useful for writing a commit message: every file stays
 * named, lockfiles/minified/binary files collapse to a one-line summary, and
 * the remaining space is shared fairly between files so one huge file can't
 * crowd out the rest.
 */
export function compactDiffForCommitMessage(
  diff: string,
  budget: number
): string {
  if (diff.length <= budget) {
    return diff
  }

  const start = diff.search(/^diff --git /m)
  const raw = start === -1 ? diff : diff.substring(0, start)
  const patches = start === -1 ? '' : diff.substring(start)
  const chunks: Array<IDiffChunk> = patches
    .split(/^(?=diff --git )/m)
    .filter(text => text.length > 0)
    .map(text => {
      const match = /^diff --git a\/(.*?) b\//.exec(text)
      return { path: match?.[1] ?? '', text }
    })

  // The raw section lists every changed file; keep it, but never let it eat
  // more than a quarter of the budget.
  const header = truncateLines(raw, Math.floor(budget / 4))

  const texts = chunks.map(chunk =>
    NoisyFilePattern.test(chunk.path)
      ? summarizeChunk(chunk, 'generated file, diff omitted')
      : /^Binary files /m.test(chunk.text)
      ? `${chunkHeader(chunk.text).trimEnd()}\n`
      : chunk.text
  )

  // Water-filling: smallest chunks first take what they need, the rest split
  // what's left evenly.
  let remaining = Math.max(0, budget - header.length)
  const shares = new Array<number>(texts.length)
  const order = texts
    .map((text, index) => ({ index, length: text.length }))
    .sort((a, b) => a.length - b.length)
  order.forEach(({ index, length }, i) => {
    const share = Math.floor(remaining / (order.length - i))
    shares[index] = Math.min(length, share)
    remaining -= shares[index]
  })

  const body = texts.map((text, index) => {
    const chunk = { path: chunks[index].path, text }
    const share = shares[index]
    // Too little room for real lines: say what changed instead.
    return share < 300 && text.length > share
      ? summarizeChunk(chunk, 'diff omitted to fit')
      : truncateChunk(chunk, share)
  })

  return header + body.join('')
}

const statusVerb = (file: WorkingDirectoryFileChange) => {
  switch (file.status.kind) {
    case AppFileStatusKind.New:
    case AppFileStatusKind.Untracked:
      return 'Add'
    case AppFileStatusKind.Deleted:
      return 'Delete'
    case AppFileStatusKind.Renamed:
    case AppFileStatusKind.Copied:
      return 'Rename'
    default:
      return 'Update'
  }
}

/**
 * Commit message used when Copilot isn't available or failed every attempt,
 * built from the file list alone.
 */
export function fallbackCommitMessage(
  files: ReadonlyArray<WorkingDirectoryFileChange>
): { readonly summary: string; readonly description: string } {
  const name = (path: string) => path.split('/').pop() ?? path
  const summary =
    files.length === 1
      ? `${statusVerb(files[0])} ${name(files[0].path)}`
      : files.length <= 3
      ? `Update ${files.map(f => name(f.path)).join(', ')}`
      : `Update ${files.length} files`

  const MaxListed = 20
  const lines = files
    .slice(0, MaxListed)
    .map(f => `- ${statusVerb(f)} ${f.path}`)
  if (files.length > MaxListed) {
    lines.push(`- …and ${files.length - MaxListed} more`)
  }
  return { summary, description: files.length > 1 ? lines.join('\n') : '' }
}
