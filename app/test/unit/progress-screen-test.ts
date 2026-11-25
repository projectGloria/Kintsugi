import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as Path from 'path'
import { mkdir } from 'fs/promises'
import { exec } from 'dugite'
import {
  currentRow,
  modelFromBulkJob,
  modelFromNewRepositoryScan,
  modelFromRedAlert,
  overallProgress,
  pickProgressScreen,
} from '../../src/ui/window/progress-screen-model'
import type { IBulkJob, IBulkJobItem } from '../../src/lib/app-state'
import { findRepositoryFolders } from '../../src/lib/find-repository-folders'
import { createTempDirectory } from '../helpers/temp'

const item = (
  name: string,
  status: IBulkJobItem['status'],
  progress: number | null = null,
  detail: string | null = null
): IBulkJobItem => ({
  name,
  path: `C:\\Users\\you\\src\\${name}`,
  status,
  detail,
  progress,
})

const job = (
  kind: IBulkJob['kind'],
  phase: IBulkJob['phase'],
  items: ReadonlyArray<IBulkJobItem>
): IBulkJob => ({ kind, phase, items, directory: null })

describe('progress screen model', () => {
  it('counts finished rows fully and clones by their own progress', () => {
    const model = modelFromBulkJob(
      job('clone-all', 'running', [
        item('a', 'done'),
        item('b', 'working', 0.5),
        item('c', 'pending'),
        item('d', 'failed'),
      ])
    )
    assert.equal(model.progress, (1 + 0.5 + 0 + 1) / 4)
    assert.equal(model.finished, 2)
    assert.equal(model.failed, 1)
    assert.equal(overallProgress([]), 0)
  })

  it('features the repository being worked on', () => {
    const model = modelFromBulkJob(
      job('add', 'running', [item('a', 'done'), item('b', 'working')])
    )
    assert.equal(currentRow(model)?.name, 'b')
    assert.equal(model.title, 'Adding 2 repositories…')
  })

  it('only looks up icons for clones once they are finished', () => {
    const model = modelFromBulkJob(
      job('clone-all', 'running', [
        item('a', 'working', 0.2),
        item('b', 'done'),
      ])
    )
    assert.deepEqual(
      model.rows.map(r => r.onDisk),
      [false, true]
    )
    const add = modelFromBulkJob(job('add', 'running', [item('a', 'working')]))
    assert.equal(add.rows[0].onDisk, true)
  })

  it('summarizes a finished check', () => {
    const model = modelFromBulkJob(
      job('check-all', 'done', [
        item('a', 'done', null, 'Clean'),
        item('b', 'done', null, '3 changed files'),
      ])
    )
    assert.equal(model.progress, 1)
    assert.equal(model.title, '2 repositories checked')
    assert.equal(model.subtitle, '1 repository with changes')
  })

  it('maps Red alert steps onto working rows', () => {
    const model = modelFromRedAlert({
      phase: 'running',
      items: [
        { name: 'a', path: 'a', status: 'pushing', detail: 'Fix typo' },
        { name: 'b', path: 'b', status: 'committed', detail: null },
      ],
    })
    assert.equal(model.tone, 'red')
    assert.deepEqual(
      model.rows.map(r => r.status),
      ['working', 'done']
    )
    assert.equal(model.rows[0].detail, 'Pushing · Fix typo')
  })

  it('keeps the startup download invisible until it has something to fetch', () => {
    assert.equal(
      modelFromNewRepositoryScan({
        phase: 'checking',
        items: [],
        directory: 'C:\\Users\\you\\src',
      }),
      null
    )
    const model = modelFromNewRepositoryScan({
      phase: 'downloading',
      directory: 'C:\\Users\\you\\src',
      items: [{ name: 'a', path: 'a', status: 'downloading', progress: 0.4 }],
    })
    assert.equal(model?.phase, 'running')
    assert.equal(model?.rows[0].progress, 0.4)
  })

  it('shows Red alert ahead of other processes', () => {
    const model = pickProgressScreen({
      redAlert: { phase: 'scanning', items: [] },
      bulkJob: job('check-all', 'running', []),
      newRepositoryScan: null,
    })
    assert.equal(model?.source, 'red-alert')
    assert.equal(
      pickProgressScreen({
        redAlert: null,
        bulkJob: null,
        newRepositoryScan: null,
      }),
      null
    )
  })
})

describe('findRepositoryFolders', () => {
  it('finds the repositories one level inside a plain folder', async t => {
    const root = await createTempDirectory(t)
    for (const name of ['beta', 'alpha']) {
      const path = Path.join(root, name)
      await mkdir(path)
      await exec(['init'], path)
    }
    await mkdir(Path.join(root, 'not-a-repo'))
    await mkdir(Path.join(root, '.hidden'))
    await exec(['init'], Path.join(root, '.hidden'))

    const found = await findRepositoryFolders([root])
    assert.deepEqual(
      found.map(p => Path.basename(p)),
      ['alpha', 'beta']
    )
  })

  it('resolves a folder inside a repository to the repository', async t => {
    const root = await createTempDirectory(t)
    const repo = Path.join(root, 'repo')
    await mkdir(Path.join(repo, 'sub'), { recursive: true })
    await exec(['init'], repo)

    const found = await findRepositoryFolders([Path.join(repo, 'sub'), repo])
    assert.equal(found.length, 1)
    assert.equal(Path.basename(found[0]), 'repo')
  })

  it('finds nothing in an empty folder', async t => {
    const root = await createTempDirectory(t)
    assert.deepEqual(await findRepositoryFolders([root]), [])
  })
})
