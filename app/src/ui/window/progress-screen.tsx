import * as React from 'react'
import classNames from 'classnames'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { useRepositoryIcon } from '../repository-library/use-repository-icon'
import { Monogram } from '../repository-library/repository-library'
import {
  currentRow,
  IProgressRow,
  IProgressScreenModel,
  ProgressRowStatus,
} from './progress-screen-model'

interface IProgressScreenProps {
  readonly model: IProgressScreenModel
  /** Keep the process running but get the screen out of the way. */
  readonly onHide: () => void
  /** Remove the screen once the process is done. */
  readonly onClose: () => void
}

const percent = (value: number) => `${Math.round(value * 100)}%`

/**
 * The Kintsugi progress screen: one full-window view below the title bar for
 * every bulk process (adding located repositories, Clone all, Check all, Red
 * alert, the startup download of new repositories). It features the
 * repository being worked on with its icon, the overall progress, and every
 * repository's status in a list.
 */
export function ProgressScreen(props: IProgressScreenProps) {
  const { model, onHide, onClose } = props
  const { phase } = model
  const current = currentRow(model)
  const done = phase === 'done'
  const clean = done && model.failed === 0

  // Escape closes a finished screen and sends a running one to the background.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        if (done) {
          onClose()
        } else {
          onHide()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [done, onClose, onHide])

  const headerSymbol = !done
    ? model.tone === 'red'
      ? octicons.alert
      : octicons.sync
    : model.failed > 0
    ? octicons.alert
    : octicons.checkCircleFill

  return (
    <div
      className={classNames('progress-screen', `tone-${model.tone}`, {
        [`phase-${phase}`]: true,
        clean,
        'has-failures': model.failed > 0,
      })}
      role="dialog"
      aria-modal="true"
      aria-label={model.title}
    >
      <div className="progress-screen-panel">
        <header className="progress-screen-header">
          <span className="progress-screen-badge">
            <Octicon
              symbol={headerSymbol}
              className={!done && model.tone === 'gold' ? 'spin' : undefined}
            />
          </span>
          <span className="progress-screen-heading" aria-live="polite">
            <span className="title">{model.title}</span>
            {model.subtitle !== null && (
              <span className="subtitle">{model.subtitle}</span>
            )}
          </span>
        </header>

        <CurrentRepository row={current} model={model} />

        <div className="progress-screen-overall">
          <ProgressBar
            value={model.progress}
            indeterminate={phase === 'preparing'}
          />
          <div className="progress-screen-stats">
            {phase === 'preparing' ? (
              <span>Preparing…</span>
            ) : (
              <>
                <span>
                  {model.finished} / {model.rows.length}
                </span>
                {model.skipped > 0 && (
                  <span className="skipped">{model.skipped} skipped</span>
                )}
                {model.failed > 0 && (
                  <span className="failed">{model.failed} failed</span>
                )}
                <span className="percent">{percent(model.progress)}</span>
              </>
            )}
          </div>
        </div>

        {model.rows.length > 0 && (
          <ul className="progress-screen-list">
            {model.rows.map(row => (
              <ProgressRow key={row.path} row={row} />
            ))}
          </ul>
        )}

        <footer className="progress-screen-footer">
          {done ? (
            <button
              className="progress-screen-button primary"
              onClick={onClose}
              autoFocus={true}
            >
              Close
            </button>
          ) : (
            <button className="progress-screen-button" onClick={onHide}>
              Run in background
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

/** The big block at the top: which repository is being worked on now. */
function CurrentRepository(props: {
  readonly row: IProgressRow | null
  readonly model: IProgressScreenModel
}) {
  const { row, model } = props
  const icon = useRepositoryIcon(row !== null && row.onDisk ? row.path : '')

  if (row === null) {
    return (
      <div className="progress-screen-current empty">
        <span className="progress-screen-current-icon">
          <Octicon
            symbol={
              model.phase === 'done'
                ? model.failed > 0
                  ? octicons.alert
                  : octicons.check
                : octicons.search
            }
          />
        </span>
        <span className="progress-screen-current-text">
          <span className="name">
            {model.phase === 'done'
              ? model.failed > 0
                ? 'Finished with errors'
                : 'All done'
              : 'Getting ready'}
          </span>
          <span className="detail">
            {model.phase === 'done'
              ? model.failed > 0
                ? 'The failed repositories are marked in red below.'
                : 'Every repository is taken care of.'
              : 'Working out which repositories to touch.'}
          </span>
        </span>
      </div>
    )
  }

  return (
    <div className="progress-screen-current">
      <span className="progress-screen-current-icon">
        {icon !== null ? (
          <img src={icon} alt="" draggable={false} />
        ) : (
          <Monogram name={row.name} />
        )}
      </span>
      <span className="progress-screen-current-text">
        <span className="name">{row.name}</span>
        <span className="detail">{row.detail}</span>
        <span className="path">{row.path}</span>
        {row.progress !== null && (
          <ProgressBar value={row.progress} indeterminate={false} />
        )}
      </span>
    </div>
  )
}

function ProgressBar(props: {
  readonly value: number
  readonly indeterminate: boolean
}) {
  return (
    <div
      className={classNames('progress-screen-bar', {
        indeterminate: props.indeterminate,
      })}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={
        props.indeterminate ? undefined : Math.round(props.value * 100)
      }
    >
      <div
        className="fill"
        style={
          props.indeterminate ? undefined : { width: percent(props.value) }
        }
      />
    </div>
  )
}

const statusSymbol = (status: ProgressRowStatus) => {
  switch (status) {
    case 'pending':
      return octicons.clock
    case 'working':
      return octicons.sync
    case 'done':
      return octicons.check
    case 'skipped':
      return octicons.skip
    case 'failed':
      return octicons.x
  }
}

const ProgressRow = React.memo(function ProgressRow(props: {
  readonly row: IProgressRow
}) {
  const { row } = props
  const icon = useRepositoryIcon(row.onDisk ? row.path : '')
  const ref = React.useRef<HTMLLIElement>(null)
  const working = row.status === 'working'

  // Keep the repository being worked on in view as the list scrolls past.
  React.useEffect(() => {
    if (working) {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [working])

  return (
    <li ref={ref} className={`status-${row.status}`} title={row.path}>
      <span className="row-icon">
        {icon !== null ? (
          <img src={icon} alt="" draggable={false} />
        ) : (
          <Monogram name={row.name} />
        )}
      </span>
      <span className="row-text">
        <span className="name">{row.name}</span>
        <span className="detail">{row.detail}</span>
      </span>
      {row.progress !== null && working && (
        <span className="row-progress">
          <ProgressBar value={row.progress} indeterminate={false} />
        </span>
      )}
      <Octicon
        symbol={statusSymbol(row.status)}
        className={classNames('row-status', { spin: working })}
      />
    </li>
  )
})
