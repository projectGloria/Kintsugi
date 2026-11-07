import * as React from 'react'
import classNames from 'classnames'
import { Repository, ILocalRepositoryState } from '../../models/repository'
import { CloningRepository } from '../../models/cloning-repository'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { useRepositoryIcon } from './use-repository-icon'
import { TooltippedContent } from '../lib/tooltipped-content'

type LibraryRepository = Repository | CloningRepository

interface IRepositoryLibraryProps {
  readonly repositories: ReadonlyArray<LibraryRepository>
  readonly selectedRepository: LibraryRepository | null
  readonly localRepositoryStateLookup: ReadonlyMap<
    number,
    ILocalRepositoryState
  >
  readonly onSelect: (repository: LibraryRepository) => void
  readonly collapsed: boolean
  readonly onToggleCollapsed: () => void
}

const displayName = (repo: LibraryRepository) =>
  repo instanceof Repository && repo.alias !== null ? repo.alias : repo.name

const ownerOf = (repo: LibraryRepository) =>
  repo instanceof Repository ? repo.gitHubRepository?.owner.login ?? null : null

/**
 * Always-visible "library" of local repositories on the right edge, so
 * switching doesn't require opening the Current repository foldout.
 */
export function RepositoryLibrary(props: IRepositoryLibraryProps) {
  const { repositories, collapsed, onToggleCollapsed } = props
  const [filter, setFilter] = React.useState('')
  // useCallback, not an inline arrow: repo lint (react/jsx-no-bind) bans
  // fresh function identities in JSX props.
  const onFilterChanged = React.useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setFilter(e.currentTarget.value),
    []
  )

  // Derived, not stored: sorting/filtering a few hundred items is trivially
  // cheap, and useMemo keeps the identity stable across unrelated app-state
  // emits (which happen constantly while git status/fetch run).
  const visible = React.useMemo(() => {
    const needle = filter.trim().toLowerCase()
    return [...repositories]
      .filter(
        r =>
          needle === '' ||
          displayName(r).toLowerCase().includes(needle) ||
          (ownerOf(r) ?? '').toLowerCase().includes(needle)
      )
      .sort((a, b) =>
        displayName(a).localeCompare(displayName(b), undefined, {
          sensitivity: 'base',
        })
      )
  }, [repositories, filter])

  const selectedHash = props.selectedRepository?.hash ?? null

  return (
    <aside
      className={classNames('repository-library', { collapsed })}
      aria-label="Repository library"
    >
      <header className="repository-library-header">
        {!collapsed && (
          <span className="repository-library-title">
            Library <span className="count">{repositories.length}</span>
          </span>
        )}
        <button
          className="repository-library-toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand library' : 'Collapse library'}
          aria-expanded={!collapsed}
        >
          <Octicon
            symbol={collapsed ? octicons.chevronLeft : octicons.chevronRight}
          />
        </button>
      </header>
      {!collapsed && (
        <input
          className="repository-library-filter"
          type="search"
          placeholder="Filter"
          value={filter}
          onChange={onFilterChanged}
        />
      )}
      <ul className="repository-library-list">
        {visible.map(repo => (
          <LibraryItem
            key={repo.hash}
            repository={repo}
            selected={repo.hash === selectedHash}
            changed={
              repo instanceof Repository &&
              (props.localRepositoryStateLookup.get(repo.id)
                ?.changedFilesCount ?? 0) > 0
            }
            collapsed={collapsed}
            onSelect={props.onSelect}
          />
        ))}
      </ul>
    </aside>
  )
}

interface ILibraryItemProps {
  readonly repository: LibraryRepository
  readonly selected: boolean
  readonly changed: boolean
  readonly collapsed: boolean
  readonly onSelect: (repository: LibraryRepository) => void
}

const LibraryItem = React.memo(function LibraryItem(props: ILibraryItemProps) {
  const { repository, selected, changed, collapsed } = props
  const cloning = repository instanceof CloningRepository
  // A cloning repo's folder is half-written; don't scan it yet.
  const icon = useRepositoryIcon(cloning ? '' : repository.path)
  const name = displayName(repository)
  const owner = ownerOf(repository)
  const { onSelect } = props
  // Stable per-row handler, otherwise React.memo on this row is pointless.
  const onClick = React.useCallback(
    () => onSelect(repository),
    [onSelect, repository]
  )

  return (
    <li>
      <button
        className={classNames('repository-library-item', { selected, cloning })}
        onClick={onClick}
        aria-label={name}
        aria-current={selected ? 'true' : undefined}
      >
        <TooltippedContent
          tagName="span"
          className="repository-library-icon"
          tooltip={`${name} — ${repository.path}`}
        >
          {cloning ? (
            <Octicon symbol={octicons.sync} className="spin" />
          ) : icon !== null ? (
            <img src={icon} alt="" draggable={false} />
          ) : (
            <Monogram name={name} />
          )}
          {changed && <span className="repository-library-dot" />}
        </TooltippedContent>
        {!collapsed && (
          <span className="repository-library-text">
            <span className="name">{name}</span>
            {owner !== null && <span className="owner">{owner}</span>}
          </span>
        )}
      </button>
    </li>
  )
})

const MonogramTones = 6

function Monogram({ name }: { readonly name: string }) {
  // Stable string hash -> tone, so a repo keeps its colour across sessions.
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const tone = Math.abs(hash) % MonogramTones
  const letter = (name.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase()
  return <span className={`monogram tone-${tone}`}>{letter}</span>
}
