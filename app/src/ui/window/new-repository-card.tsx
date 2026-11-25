import * as React from 'react'
import classNames from 'classnames'
import { INewRepositoryScan, INewRepositoryScanItem } from '../../lib/app-state'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface INewRepositoryCardProps {
  readonly sync: INewRepositoryScan
  readonly onDismiss: () => void
}

/** At most this many repository rows; the rest collapse into "+N more". */
const MaxVisibleItems = 5

const repositories = (n: number) =>
  `${n} ${n === 1 ? 'repository' : 'repositories'}`

/**
 * Floating card under the title bar that shows Kintsugi's startup pass
 * finding and downloading repositories created since the last launch.
 */
export function NewRepositoryCard(props: INewRepositoryCardProps) {
  const { sync, onDismiss } = props
  const { phase, items } = sync

  const finished = items.filter(
    i => i.status === 'done' || i.status === 'failed'
  ).length
  const failed = items.filter(i => i.status === 'failed').length
  const downloaded = items.filter(i => i.status === 'done').length
  // Overall bar: finished repositories count fully, in-flight ones by their
  // own clone progress, so the bar moves smoothly instead of in big steps.
  const progress =
    items.length === 0
      ? 0
      : items.reduce((sum, i) => sum + i.progress, 0) / items.length

  const title =
    phase === 'checking'
      ? 'Checking GitHub for new repositories…'
      : phase === 'up-to-date'
      ? 'No new repositories'
      : phase === 'downloading'
      ? `${items.length} new ${
          items.length === 1 ? 'repository' : 'repositories'
        } found, downloading…`
      : failed === 0
      ? `${repositories(downloaded)} downloaded`
      : `${downloaded} downloaded, ${failed} failed`

  const subtitle =
    phase === 'downloading'
      ? `${finished} of ${items.length} · into ${sync.directory}`
      : phase === 'done'
      ? `Added to your library from ${sync.directory}`
      : phase === 'up-to-date'
      ? 'Everything you own is already here'
      : null

  const icon =
    phase === 'checking'
      ? octicons.sync
      : phase === 'downloading'
      ? octicons.desktopDownload
      : phase === 'done' && failed > 0
      ? octicons.alert
      : octicons.checkCircleFill

  const canDismiss = phase === 'done' || phase === 'up-to-date'
  const visible = items.slice(0, MaxVisibleItems)
  const hidden = items.length - visible.length

  return (
    <div
      className={classNames('new-repository-card', `phase-${phase}`, {
        'has-failures': failed > 0,
      })}
      role="status"
      aria-live="polite"
    >
      <div className="new-repository-card-header">
        <span className="new-repository-card-icon">
          <Octicon
            symbol={icon}
            className={phase === 'checking' ? 'spin' : undefined}
          />
        </span>
        <span className="new-repository-card-text">
          <span className="title">{title}</span>
          {subtitle !== null && <span className="subtitle">{subtitle}</span>}
        </span>
        {canDismiss && (
          <button
            className="new-repository-card-close"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <Octicon symbol={octicons.x} />
          </button>
        )}
      </div>
      {phase !== 'up-to-date' && (
        <div
          className={classNames('new-repository-card-bar', {
            indeterminate: phase === 'checking',
          })}
        >
          <div
            className="fill"
            style={
              phase === 'checking'
                ? undefined
                : { width: `${Math.round(progress * 100)}%` }
            }
          />
        </div>
      )}
      {visible.length > 0 && (
        <ul className="new-repository-card-list">
          {visible.map(item => (
            <NewRepositoryRow key={item.name} item={item} />
          ))}
          {hidden > 0 && <li className="more">+{hidden} more</li>}
        </ul>
      )}
    </div>
  )
}

function NewRepositoryRow({ item }: { readonly item: INewRepositoryScanItem }) {
  const symbol =
    item.status === 'done'
      ? octicons.check
      : item.status === 'failed'
      ? octicons.x
      : item.status === 'downloading'
      ? octicons.sync
      : octicons.clock
  return (
    <li className={`status-${item.status}`}>
      <Octicon
        symbol={symbol}
        className={item.status === 'downloading' ? 'spin' : undefined}
      />
      <span className="name">{item.name}</span>
      {item.status === 'downloading' && (
        <span className="percent">{Math.round(item.progress * 100)}%</span>
      )}
    </li>
  )
}
