import * as React from 'react'
import classNames from 'classnames'
import { Dispatcher } from '../dispatcher'
import { ICloneAllProgress } from '../../lib/app-state'
import { encodePathAsUrl } from '../../lib/path'
import { showOpenDialog } from '../main-process-proxy'
import { getDefaultDir, setDefaultDir } from '../lib/default-dir'
import { clearRepositoryIconCache } from '../../lib/repository-icon'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface IKintsugiMenuProps {
  readonly dispatcher: Dispatcher
  readonly hasAccounts: boolean
  readonly isCheckingAllRepositories: boolean
  readonly cloneAllProgress: ICloneAllProgress | null
  /** Repositories with uncommitted changes (derived by the caller). */
  readonly dirtyCount: number
}

/**
 * The centered "Kintsugi" button in the Windows title bar. Hosts the
 * Kintsugi-only batch actions. Built in React rather than as a native
 * popup menu so it can anchor under the button and show live progress.
 */
export function KintsugiMenu(props: IKintsugiMenuProps) {
  const { dispatcher, cloneAllProgress, isCheckingAllRepositories } = props
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  // Close on outside mousedown / Escape. Listeners only exist while open, so
  // the title bar costs nothing the rest of the time.
  React.useEffect(() => {
    if (!open) {
      return
    }
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const onToggleOpen = React.useCallback(() => setOpen(o => !o), [])

  // useCallback rather than inline arrows: repo lint (react/jsx-no-bind)
  // forbids fresh function identities in JSX props.
  const { hasAccounts } = props
  const onCloneAll = React.useCallback(async () => {
    setOpen(false)
    if (!hasAccounts) {
      dispatcher.showDotComSignInDialog()
      return
    }
    const directory = await showOpenDialog({
      title: 'Clone all repositories into…',
      buttonLabel: 'Clone here',
      defaultPath: await getDefaultDir(),
      properties: ['createDirectory', 'openDirectory'],
    })
    if (directory === null) {
      return
    }
    setDefaultDir(directory)
    dispatcher.cloneAllRepositories(directory)
  }, [dispatcher, hasAccounts])

  const onCheckAll = React.useCallback(() => {
    setOpen(false)
    // Rescan icons too: "check all" is the user's explicit "refresh
    // everything" gesture, and icons rarely change otherwise.
    clearRepositoryIconCache()
    dispatcher.checkAllRepositories()
  }, [dispatcher])

  const busyLabel =
    cloneAllProgress !== null
      ? `Cloning ${
          cloneAllProgress.cloned +
          cloneAllProgress.skipped +
          cloneAllProgress.failed
        }/${cloneAllProgress.total}`
      : isCheckingAllRepositories
      ? 'Checking…'
      : null

  const checkAllDescription = isCheckingAllRepositories
    ? 'Checking repositories…'
    : props.dirtyCount === 0
    ? 'No uncommitted changes'
    : `${props.dirtyCount} ${
        props.dirtyCount === 1 ? 'repository' : 'repositories'
      } changed`

  const cloneAllDescription = !props.hasAccounts
    ? 'Sign in to GitHub first'
    : cloneAllProgress !== null
    ? `${cloneAllProgress.cloned} cloned · ${cloneAllProgress.skipped} skipped · ${cloneAllProgress.failed} failed`
    : 'Every repository you own; existing ones are skipped'

  return (
    <div className="kintsugi-menu" ref={rootRef}>
      <button
        className={classNames('kintsugi-menu-button', { open })}
        onClick={onToggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <img
          src={encodePathAsUrl(__dirname, 'static/kintsugi-icon.png')}
          alt=""
          width={14}
          height={14}
        />
        <span>Kintsugi</span>
        {busyLabel !== null && (
          <span className="kintsugi-menu-busy">{busyLabel}</span>
        )}
        <Octicon symbol={octicons.triangleDown} />
      </button>
      {open && (
        <div className="kintsugi-menu-dropdown" role="menu">
          <MenuItem
            icon={octicons.desktopDownload}
            title="Clone all repositories"
            description={cloneAllDescription}
            disabled={cloneAllProgress !== null}
            spinning={false}
            onClick={onCloneAll}
          />
          <MenuItem
            icon={octicons.sync}
            title="Check all"
            description={checkAllDescription}
            disabled={isCheckingAllRepositories}
            spinning={isCheckingAllRepositories}
            onClick={onCheckAll}
          />
        </div>
      )}
    </div>
  )
}

interface IMenuItemProps {
  readonly icon: typeof octicons.sync
  readonly title: string
  readonly description: string
  readonly disabled: boolean
  readonly spinning: boolean
  readonly onClick: () => void
}

function MenuItem(props: IMenuItemProps) {
  return (
    <button
      className="kintsugi-menu-item"
      role="menuitem"
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <Octicon
        symbol={props.icon}
        className={props.spinning ? 'spin' : undefined}
      />
      <span className="kintsugi-menu-item-text">
        <span className="title">{props.title}</span>
        <span className="description">{props.description}</span>
      </span>
    </button>
  )
}
