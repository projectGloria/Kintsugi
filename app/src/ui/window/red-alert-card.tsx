import * as React from 'react'
import classNames from 'classnames'
import {
  IRedAlertItem,
  IRedAlertRun,
  RedAlertItemStatus,
} from '../../lib/app-state'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IRedAlertCardProps {
  readonly run: IRedAlertRun
  readonly onDismiss: () => void
}

/** At most this many rows; the rest collapse into "+N more". */
const MaxVisibleItems = 6

const repositories = (n: number) =>
  `${n} ${n === 1 ? 'repository' : 'repositories'}`

/** Statuses a repository ends in. */
const isFinished = (status: RedAlertItemStatus) =>
  status === 'done' ||
  status === 'committed' ||
  status === 'skipped' ||
  status === 'failed'

const statusLabel = (status: RedAlertItemStatus) => {
  switch (status) {
    case 'pending':
      return 'Waiting'
    case 'writing':
      return 'Writing message'
    case 'committing':
      return 'Committing'
    case 'pushing':
      return 'Pushing'
    case 'done':
      return 'Pushed'
    case 'committed':
      return 'Committed, no remote'
    case 'skipped':
      return 'Skipped'
    case 'failed':
      return 'Failed'
  }
}

/**
 * Floating card under the title bar that shows a Kintsugi "Red alert!" run:
 * every changed repository committed with a generated message and pushed.
 */
export function RedAlertCard(props: IRedAlertCardProps) {
  const { run, onDismiss } = props
  const { phase, items } = run

  const pushed = items.filter(i => i.status === 'done').length
  const committedOnly = items.filter(i => i.status === 'committed').length
  const skipped = items.filter(i => i.status === 'skipped').length
  const failed = items.filter(i => i.status === 'failed').length
  const finished = items.filter(i => isFinished(i.status)).length
  const progress = items.length === 0 ? 0 : finished / items.length

  const title =
    phase === 'scanning'
      ? 'Red alert! Looking for changes…'
      : phase === 'running'
      ? `Red alert! Committing ${repositories(items.length)}…`
      : items.length === 0
      ? 'Nothing to commit'
      : failed === 0 && skipped === 0
      ? `${repositories(pushed + committedOnly)} committed and pushed`
      : `${pushed + committedOnly} done, ${failed} failed, ${skipped} skipped`

  const subtitle =
    phase === 'running'
      ? `${finished} of ${items.length}`
      : phase === 'done' && items.length === 0
      ? 'Every repository is clean'
      : phase === 'done' && committedOnly > 0
      ? `${committedOnly} had no remote and stayed local`
      : null

  const icon =
    phase === 'done' && items.length > 0 && failed === 0 && skipped === 0
      ? octicons.checkCircleFill
      : phase === 'done' && items.length === 0
      ? octicons.checkCircleFill
      : octicons.alert

  const visible = items.slice(0, MaxVisibleItems)
  const hidden = items.length - visible.length

  return (
    <div
      className={classNames('red-alert-card', `phase-${phase}`, {
        'has-failures': failed > 0,
        clean: phase === 'done' && failed === 0 && skipped === 0,
      })}
      role="status"
      aria-live="polite"
    >
      <div className="red-alert-card-header">
        <span className="red-alert-card-icon">
          <Octicon symbol={icon} />
        </span>
        <span className="red-alert-card-text">
          <span className="title">{title}</span>
          {subtitle !== null && <span className="subtitle">{subtitle}</span>}
        </span>
        {phase === 'done' && (
          <button
            className="red-alert-card-close"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            <Octicon symbol={octicons.x} />
          </button>
        )}
      </div>
      {(phase !== 'done' || items.length > 0) && (
        <div
          className={classNames('red-alert-card-bar', {
            indeterminate: phase === 'scanning',
          })}
        >
          <div
            className="fill"
            style={
              phase === 'scanning'
                ? undefined
                : { width: `${Math.round(progress * 100)}%` }
            }
          />
        </div>
      )}
      {visible.length > 0 && (
        <ul className="red-alert-card-list">
          {visible.map(item => (
            <RedAlertRow key={item.name} item={item} />
          ))}
          {hidden > 0 && <li className="more">+{hidden} more</li>}
        </ul>
      )}
    </div>
  )
}

function RedAlertRow({ item }: { readonly item: IRedAlertItem }) {
  const busy =
    item.status === 'writing' ||
    item.status === 'committing' ||
    item.status === 'pushing'
  const symbol =
    item.status === 'done' || item.status === 'committed'
      ? octicons.check
      : item.status === 'failed'
      ? octicons.x
      : item.status === 'skipped'
      ? octicons.skip
      : busy
      ? octicons.sync
      : octicons.clock
  return (
    <li className={`status-${item.status}`}>
      <Octicon symbol={symbol} className={busy ? 'spin' : undefined} />
      <span className="row-text">
        <span className="name">{item.name}</span>
        <span className="detail">
          {item.detail !== null && item.status !== 'pending'
            ? item.detail
            : statusLabel(item.status)}
        </span>
      </span>
    </li>
  )
}
