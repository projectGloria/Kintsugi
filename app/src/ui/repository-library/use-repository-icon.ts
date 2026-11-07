import { useEffect, useState } from 'react'
import {
  findRepositoryIcon,
  getRepositoryIconCacheVersion,
  onRepositoryIconCacheCleared,
} from '../../lib/repository-icon'

/** Subscribe to icon-cache clears (React 16 has no useSyncExternalStore). */
function useIconCacheVersion() {
  const [version, setVersion] = useState(getRepositoryIconCacheVersion)
  useEffect(() => onRepositoryIconCacheCleared(setVersion), [])
  return version
}

/**
 * Resolve a repository's icon as a data URI. `null` means "not found (yet)",
 * which the caller renders as a monogram tile. Pass '' to skip scanning.
 */
export function useRepositoryIcon(path: string) {
  const [icon, setIcon] = useState<string | null>(null)
  // In the dependency list so a "Check all" (which clears the icon cache)
  // re-runs the lookup for rows that are already mounted.
  const version = useIconCacheVersion()

  useEffect(() => {
    // Empty path = "don't scan" (e.g. a repository that is still cloning).
    // Without this, '' would resolve to the process cwd and scan that.
    if (path === '') {
      setIcon(null)
      return
    }
    // Guard against a stale resolve: if the row is unmounted or re-pointed at
    // another path before the scan finishes, the older promise must not
    // overwrite newer state.
    let ignore = false
    findRepositoryIcon(path).then(uri => {
      if (!ignore) {
        setIcon(uri)
      }
    })
    return () => {
      ignore = true
    }
  }, [path, version])

  return icon
}
