import * as Path from 'path'
import { readdir, readFile, stat } from 'fs/promises'

/**
 * Best-effort discovery of a repository's own icon/logo, returned as a data
 * URI so it renders regardless of path characters (spaces, #, %) that would
 * need careful file:// encoding. SVGs loaded through <img> can't run script,
 * so data URIs are safe to render here.
 */

const MaxDepth = 3
const MaxEntries = 400
const MaxFileSize = 1024 * 1024

const IgnoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'vendor',
  '.next',
  'target',
  'bin',
  'obj',
  '.tools',
  'coverage',
  '__pycache__',
])

const MimeTypes: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

const ExtensionScore: Record<string, number> = {
  '.png': 30,
  '.svg': 30,
  '.ico': 20,
  '.webp': 15,
  '.jpg': 5,
  '.jpeg': 5,
}

const IconName =
  /(^|[-_.\s])(icon|logo|favicon|appicon|app-icon)([-_.@\s\d]|$)/i
const FavoredFolders =
  /(^|\/)(public|assets|static|res|resources|\.github|images|img|icons|branding|build)(\/|$)/i
const PenalizedFolders =
  /(^|\/)(test|tests|__tests__|fixtures?|examples?|docs?|samples?|node_modules)(\/|$)/i

/** Cache keyed by repository path; storing the promise de-dupes concurrent scans. */
const cache = new Map<string, Promise<string | null>>()
const storageKey = (repoPath: string) => `kintsugi-repo-icon:${repoPath}`

/**
 * Bumped on every cache clear. Mounted rows subscribe to it so a "Check all"
 * rescans icons without threading a version prop through the App tree.
 */
let cacheVersion = 0
const versionListeners = new Set<(version: number) => void>()

export function getRepositoryIconCacheVersion() {
  return cacheVersion
}

export function onRepositoryIconCacheCleared(
  listener: (version: number) => void
): () => void {
  versionListeners.add(listener)
  return () => versionListeners.delete(listener)
}

/** Forget cached icons (e.g. after "Check all") so repositories get rescanned. */
export function clearRepositoryIconCache() {
  cache.clear()
  cacheVersion++
  versionListeners.forEach(listener => listener(cacheVersion))
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (key?.startsWith('kintsugi-repo-icon:')) {
      localStorage.removeItem(key)
    }
  }
}

export function findRepositoryIcon(repoPath: string): Promise<string | null> {
  let pending = cache.get(repoPath)
  if (pending === undefined) {
    pending = resolveIcon(repoPath).catch(e => {
      log.warn(`[RepositoryIcon] Failed to scan ${repoPath}`, e)
      return null
    })
    cache.set(repoPath, pending)
  }
  return pending
}

async function resolveIcon(repoPath: string): Promise<string | null> {
  // Only the chosen relative path is persisted (not the base64 payload) so
  // localStorage stays small even with hundreds of repositories.
  const remembered = localStorage.getItem(storageKey(repoPath))
  if (remembered !== null) {
    if (remembered === '') {
      return null
    }
    const uri = await toDataUri(Path.join(repoPath, remembered))
    if (uri !== null) {
      return uri
    }
  }

  const relative =
    (await findDeclaredIcon(repoPath)) ?? (await scanForIcon(repoPath))
  localStorage.setItem(storageKey(repoPath), relative ?? '')
  return relative === null ? null : toDataUri(Path.join(repoPath, relative))
}

/** Icons the project declares explicitly (package.json, web manifests). */
async function findDeclaredIcon(repoPath: string): Promise<string | null> {
  const candidates = new Array<string>()

  const pkg = await readJson(Path.join(repoPath, 'package.json'))
  if (pkg !== null) {
    for (const value of [pkg.icon, pkg.build?.icon, pkg.build?.win?.icon]) {
      if (typeof value === 'string') {
        candidates.push(value)
      }
    }
  }

  for (const manifest of [
    'manifest.json',
    'site.webmanifest',
    'public/manifest.json',
    'public/site.webmanifest',
  ]) {
    const json = await readJson(Path.join(repoPath, manifest))
    const icons = Array.isArray(json?.icons) ? json.icons : []
    const base = Path.dirname(manifest)
    for (const icon of icons) {
      if (typeof icon?.src === 'string' && !/^[a-z]+:/i.test(icon.src)) {
        candidates.push(Path.join(base, icon.src.replace(/^\//, '')))
      }
    }
  }

  for (const candidate of candidates) {
    const relative = Path.normalize(candidate)
    // Never follow a declaration out of the repository.
    if (relative.startsWith('..') || Path.isAbsolute(relative)) {
      continue
    }
    if (
      isImage(relative) &&
      (await isUsableFile(Path.join(repoPath, relative)))
    ) {
      return relative
    }
    // electron-builder allows extensionless icon paths ("build/icon").
    for (const ext of ['.png', '.ico', '.svg']) {
      if (await isUsableFile(Path.join(repoPath, relative + ext))) {
        return relative + ext
      }
    }
  }

  return null
}

/** Breadth-first scan for icon/logo-looking image files, best score wins. */
async function scanForIcon(repoPath: string): Promise<string | null> {
  let best: { relative: string; score: number } | null = null
  let visited = 0
  const queue: Array<{ dir: string; depth: number }> = [{ dir: '', depth: 0 }]

  while (queue.length > 0 && visited < MaxEntries) {
    const { dir, depth } = queue.shift()!
    let entries
    try {
      entries = await readdir(Path.join(repoPath, dir), { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (++visited > MaxEntries) {
        break
      }
      const relative = dir === '' ? entry.name : `${dir}/${entry.name}`

      if (entry.isDirectory()) {
        if (
          depth < MaxDepth &&
          !IgnoredDirectories.has(entry.name.toLowerCase())
        ) {
          queue.push({ dir: relative, depth: depth + 1 })
        }
        continue
      }

      if (!entry.isFile() || !isImage(entry.name)) {
        continue
      }
      const base = Path.basename(entry.name, Path.extname(entry.name))
      if (
        !IconName.test(base) &&
        !(depth === 0 && /\.ico$/i.test(entry.name))
      ) {
        continue
      }

      const score = scoreCandidate(relative, depth)
      if (
        (best === null || score > best.score) &&
        (await isUsableFile(Path.join(repoPath, relative)))
      ) {
        best = { relative, score }
      }
    }
  }

  return best?.relative ?? null
}

function scoreCandidate(relative: string, depth: number) {
  const name = Path.basename(relative).toLowerCase()
  const ext = Path.extname(name)
  let score = 100 - depth * 15 + (ExtensionScore[ext] ?? 0)

  if (/(^|[-_.])(icon|appicon|app-icon)/.test(name)) {
    score += 25
  } else if (/logo/.test(name)) {
    score += 20
  } else if (/favicon/.test(name)) {
    score += 10
  }
  if (FavoredFolders.test(relative)) {
    score += 15
  }
  if (PenalizedFolders.test(relative)) {
    score -= 60
  }
  // Prefer the app's own icon over generic variants (mono, tray, small...).
  if (/(mono|tray|small|16|dark|light|disabled)/.test(name)) {
    score -= 10
  }
  return score
}

function isImage(name: string) {
  return Path.extname(name).toLowerCase() in MimeTypes
}

async function isUsableFile(path: string) {
  try {
    const info = await stat(path)
    return info.isFile() && info.size > 0 && info.size <= MaxFileSize
  } catch {
    return false
  }
}

async function toDataUri(path: string): Promise<string | null> {
  const mime = MimeTypes[Path.extname(path).toLowerCase()]
  if (mime === undefined || !(await isUsableFile(path))) {
    return null
  }
  const contents = await readFile(path)
  return `data:${mime};base64,${contents.toString('base64')}`
}

async function readJson(path: string): Promise<any | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}
