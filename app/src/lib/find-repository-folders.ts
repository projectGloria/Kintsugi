import * as Path from 'path'
import { readdir } from 'fs/promises'
import { getRepositoryType } from './git/rev-parse'

/** Concurrent `git rev-parse` probes while searching a folder. */
const ProbeConcurrency = 6

/**
 * Resolve `path` to the repository it belongs to: its top-level working
 * directory, `path` itself for a repository Git refuses as unsafe (Kintsugi
 * adds those as "missing" so the user can fix ownership), or null.
 */
async function resolveRepository(path: string): Promise<string | null> {
  const type = await getRepositoryType(path).catch(() => null)
  if (type === null) {
    return null
  }
  switch (type.kind) {
    case 'regular':
      return type.topLevelWorkingDirectory
    case 'unsafe':
      return path
    default:
      return null
  }
}

/** Child folders of `path`, skipping hidden ones like `.git` or `.vscode`. */
async function childFolders(path: string): Promise<ReadonlyArray<string>> {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => [])
  return entries
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => Path.join(path, e.name))
}

/**
 * The Git repositories among `paths`, for "Locate existing sources" and
 * dropping folders on the window. A path inside a repository resolves to
 * that repository; a path that isn't in one is searched one level deep, so
 * the folder that holds all your repositories yields every one of them.
 *
 * The result has no duplicates and is sorted by folder name.
 */
export async function findRepositoryFolders(
  paths: ReadonlyArray<string>
): Promise<ReadonlyArray<string>> {
  const found = new Map<string, string>()
  const add = (path: string) => {
    const key = Path.resolve(path).toLowerCase()
    if (!found.has(key)) {
      found.set(key, path)
    }
  }

  const candidates = new Array<string>()
  for (const path of paths) {
    const repository = await resolveRepository(path)
    if (repository !== null) {
      add(repository)
    } else {
      candidates.push(...(await childFolders(path)))
    }
  }

  const queue = [...candidates]
  const probe = async () => {
    for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
      const repository = await resolveRepository(path)
      // Only the child itself: a child that resolves somewhere else is just
      // a plain folder inside a repository we'd already have found.
      if (
        repository !== null &&
        Path.resolve(repository).toLowerCase() ===
          Path.resolve(path).toLowerCase()
      ) {
        add(repository)
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(ProbeConcurrency, queue.length) }, probe)
  )

  return [...found.values()].sort((a, b) =>
    Path.basename(a).localeCompare(Path.basename(b), undefined, {
      sensitivity: 'base',
    })
  )
}
