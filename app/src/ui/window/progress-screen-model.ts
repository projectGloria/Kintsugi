import type {
  IBulkJob,
  INewRepositoryScan,
  IRedAlertRun,
  RedAlertItemStatus,
} from '../../lib/app-state'
import { assertNever } from '../../lib/fatal-error'

/** Where a repository row stands, the same vocabulary for every process. */
export type ProgressRowStatus =
  | 'pending'
  | 'working'
  | 'done'
  | 'skipped'
  | 'failed'

export interface IProgressRow {
  readonly name: string
  readonly path: string
  readonly status: ProgressRowStatus
  /** What is happening to this repository, or how it ended. */
  readonly detail: string
  /** 0 to 1 for steps with measurable progress (clones), else null. */
  readonly progress: number | null
  /**
   * Whether the folder is complete on disk, so its icon can be looked up.
   * False for clones that haven't finished: their folder is half-written.
   */
  readonly onDisk: boolean
}

/** Which store state a progress screen comes from, for dismissing it. */
export type ProgressScreenSource = 'bulk' | 'red-alert' | 'new-repositories'

/** Everything the Kintsugi progress screen renders. */
export interface IProgressScreenModel {
  readonly source: ProgressScreenSource
  /** Red alert gets its own red styling; everything else is gold. */
  readonly tone: 'gold' | 'red'
  /** Short name of the process, for the title bar while hidden. */
  readonly label: string
  readonly title: string
  readonly subtitle: string | null
  /**
   * preparing: still working out which repositories to touch (no list yet).
   * running: working through `rows`.
   * done: finished; the screen can be closed.
   */
  readonly phase: 'preparing' | 'running' | 'done'
  readonly rows: ReadonlyArray<IProgressRow>
  /** Overall progress, 0 to 1. */
  readonly progress: number
  readonly finished: number
  readonly failed: number
  readonly skipped: number
}

const repositories = (n: number) =>
  `${n} ${n === 1 ? 'repository' : 'repositories'}`

const isFinished = (status: ProgressRowStatus) =>
  status === 'done' || status === 'skipped' || status === 'failed'

/**
 * Overall progress: finished rows count fully, in-flight ones by their own
 * progress when they have one, so the bar moves smoothly during clones.
 */
export function overallProgress(rows: ReadonlyArray<IProgressRow>) {
  if (rows.length === 0) {
    return 0
  }
  const sum = rows.reduce(
    (total, row) =>
      total +
      (isFinished(row.status)
        ? 1
        : row.status === 'working' && row.progress !== null
        ? Math.min(1, Math.max(0, row.progress))
        : 0),
    0
  )
  return sum / rows.length
}

function summarize(
  source: ProgressScreenSource,
  tone: IProgressScreenModel['tone'],
  label: string,
  phase: IProgressScreenModel['phase'],
  rows: ReadonlyArray<IProgressRow>,
  text: (counts: {
    finished: number
    done: number
    failed: number
    skipped: number
  }) => { title: string; subtitle: string | null }
): IProgressScreenModel {
  const count = (status: ProgressRowStatus) =>
    rows.filter(r => r.status === status).length
  const counts = {
    finished: rows.filter(r => isFinished(r.status)).length,
    done: count('done'),
    failed: count('failed'),
    skipped: count('skipped'),
  }
  return {
    source,
    tone,
    label,
    phase,
    rows,
    progress: phase === 'done' ? 1 : overallProgress(rows),
    finished: counts.finished,
    failed: counts.failed,
    skipped: counts.skipped,
    ...text(counts),
  }
}

/** Outcome line shared by the bulk jobs once they finish. */
function outcome(
  verb: string,
  counts: { done: number; failed: number; skipped: number }
) {
  const parts = [`${counts.done} ${verb}`]
  if (counts.skipped > 0) {
    parts.push(`${counts.skipped} skipped`)
  }
  if (counts.failed > 0) {
    parts.push(`${counts.failed} failed`)
  }
  return parts.join(' · ')
}

export function modelFromBulkJob(job: IBulkJob): IProgressScreenModel {
  const rows: ReadonlyArray<IProgressRow> = job.items.map(item => ({
    name: item.name,
    path: item.path,
    status: item.status,
    progress: item.progress,
    onDisk:
      job.kind !== 'clone-all' ||
      item.status === 'done' ||
      item.status === 'skipped',
    detail:
      item.detail ??
      (item.status === 'pending'
        ? 'Waiting'
        : item.status === 'working'
        ? 'Working'
        : ''),
  }))
  const total = rows.length

  switch (job.kind) {
    case 'add':
      return summarize('bulk', 'gold', 'Adding', job.phase, rows, c => ({
        title:
          job.phase === 'preparing'
            ? 'Looking for repositories…'
            : job.phase === 'running'
            ? `Adding ${repositories(total)}…`
            : `${repositories(c.done)} added`,
        subtitle:
          job.phase === 'preparing'
            ? 'Searching the selected folders'
            : job.phase === 'running'
            ? `${c.finished} of ${total}`
            : outcome('added', c),
      }))
    case 'clone-all':
      return summarize('bulk', 'gold', 'Cloning', job.phase, rows, c => ({
        title:
          job.phase === 'preparing'
            ? 'Asking GitHub for your repositories…'
            : job.phase === 'running'
            ? `Cloning ${repositories(total - c.skipped)}…`
            : total === 0
            ? 'No repositories found on GitHub'
            : `${repositories(c.done)} cloned`,
        subtitle:
          job.phase === 'done'
            ? outcome('cloned', c)
            : job.directory !== null
            ? `${
                job.phase === 'running' ? `${c.finished} of ${total} · ` : ''
              }into ${job.directory}`
            : null,
      }))
    case 'check-all':
      return summarize('bulk', 'gold', 'Checking', job.phase, rows, c => {
        const changed = job.items.filter(
          i => i.status === 'done' && i.detail !== 'Clean'
        ).length
        return {
          title:
            job.phase === 'done'
              ? `${repositories(c.done)} checked`
              : `Checking ${repositories(total)}…`,
          subtitle:
            job.phase === 'done'
              ? c.failed > 0
                ? `${changed} with changes · ${c.failed} failed`
                : changed === 0
                ? 'Everything is clean'
                : `${repositories(changed)} with changes`
              : `${c.finished} of ${total}`,
        }
      })
    default:
      return assertNever(job.kind, `Unknown bulk job ${job.kind}`)
  }
}

function redAlertRowStatus(status: RedAlertItemStatus): ProgressRowStatus {
  switch (status) {
    case 'pending':
      return 'pending'
    case 'writing':
    case 'committing':
    case 'pushing':
      return 'working'
    case 'done':
    case 'committed':
      return 'done'
    case 'skipped':
      return 'skipped'
    case 'failed':
      return 'failed'
    default:
      return assertNever(status, `Unknown Red alert status ${status}`)
  }
}

function redAlertStatusLabel(status: RedAlertItemStatus) {
  switch (status) {
    case 'pending':
      return 'Waiting'
    case 'writing':
      return 'Writing commit message'
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
    default:
      return assertNever(status, `Unknown Red alert status ${status}`)
  }
}

export function modelFromRedAlert(run: IRedAlertRun): IProgressScreenModel {
  const rows: ReadonlyArray<IProgressRow> = run.items.map(item => ({
    name: item.name,
    path: item.path,
    status: redAlertRowStatus(item.status),
    progress: null,
    onDisk: true,
    // While working, say which step; the commit summary rides along once
    // it's written. Finished rows show the summary or the reason.
    detail:
      item.status === 'committing' || item.status === 'pushing'
        ? `${redAlertStatusLabel(item.status)}${
            item.detail !== null ? ` · ${item.detail}` : ''
          }`
        : item.detail !== null && item.status !== 'pending'
        ? item.detail
        : redAlertStatusLabel(item.status),
  }))
  const phase = run.phase === 'scanning' ? 'preparing' : run.phase
  return summarize('red-alert', 'red', 'Red alert', phase, rows, c => ({
    title:
      run.phase === 'scanning'
        ? 'Red alert! Looking for changes…'
        : run.phase === 'running'
        ? `Red alert! Committing ${repositories(rows.length)}…`
        : rows.length === 0
        ? 'Nothing to commit'
        : c.failed === 0 && c.skipped === 0
        ? `${repositories(c.done)} committed and pushed`
        : outcome('done', c),
    subtitle:
      run.phase === 'running'
        ? `${c.finished} of ${rows.length}`
        : run.phase === 'done' && rows.length === 0
        ? 'Every repository is clean'
        : run.phase === 'scanning'
        ? 'Running git status in every repository'
        : null,
  }))
}

/**
 * The startup pass only takes over the screen once it has something to
 * download; checking GitHub and finding nothing new stays invisible.
 */
export function modelFromNewRepositoryScan(
  scan: INewRepositoryScan
): IProgressScreenModel | null {
  if (scan.items.length === 0 || scan.phase === 'checking') {
    return null
  }
  const rows: ReadonlyArray<IProgressRow> = scan.items.map(item => ({
    name: item.name,
    path: item.path,
    status:
      item.status === 'downloading'
        ? 'working'
        : item.status === 'done'
        ? 'done'
        : item.status,
    progress: item.status === 'downloading' ? item.progress : null,
    onDisk: item.status === 'done',
    detail:
      item.status === 'pending'
        ? 'Waiting'
        : item.status === 'downloading'
        ? 'Downloading'
        : item.status === 'done'
        ? 'Downloaded'
        : 'Download failed',
  }))
  const phase = scan.phase === 'downloading' ? 'running' : 'done'
  return summarize(
    'new-repositories',
    'gold',
    'Downloading',
    phase,
    rows,
    c => ({
      title:
        phase === 'running'
          ? `Downloading ${repositories(rows.length)} new on GitHub…`
          : `${repositories(c.done)} downloaded`,
      subtitle:
        phase === 'running'
          ? `${c.finished} of ${rows.length} · into ${scan.directory}`
          : outcome('downloaded', c),
    })
  )
}

/**
 * The one process the screen shows. Red alert wins (it changes your
 * repositories), then the job the user started, then the startup download.
 */
export function pickProgressScreen(state: {
  readonly redAlert: IRedAlertRun | null
  readonly bulkJob: IBulkJob | null
  readonly newRepositoryScan: INewRepositoryScan | null
}): IProgressScreenModel | null {
  if (state.redAlert !== null) {
    return modelFromRedAlert(state.redAlert)
  }
  if (state.bulkJob !== null) {
    return modelFromBulkJob(state.bulkJob)
  }
  if (state.newRepositoryScan !== null) {
    return modelFromNewRepositoryScan(state.newRepositoryScan)
  }
  return null
}

/** The row to feature at the top: the first one being worked on. */
export function currentRow(model: IProgressScreenModel): IProgressRow | null {
  return (
    model.rows.find(r => r.status === 'working') ??
    (model.phase === 'done'
      ? null
      : model.rows.find(r => r.status === 'pending') ?? null)
  )
}
