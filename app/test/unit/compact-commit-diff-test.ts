import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  compactDiffForCommitMessage,
  fallbackCommitMessage,
  RedAlertDiffBudgets,
} from '../../src/lib/compact-commit-diff'
import {
  AppFileStatusKind,
  WorkingDirectoryFileChange,
} from '../../src/models/status'
import { DiffSelection, DiffSelectionType } from '../../src/models/diff'

const fileDiff = (path: string, lines: number, prefix = 'line') =>
  `diff --git a/${path} b/${path}\nindex 1111111..2222222 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,${lines} +1,${lines} @@\n` +
  Array.from({ length: lines }, (_, i) => `+${prefix} ${i}`).join('\n') +
  '\n'

const file = (
  path: string,
  kind:
    | AppFileStatusKind.New
    | AppFileStatusKind.Modified
    | AppFileStatusKind.Deleted
) =>
  new WorkingDirectoryFileChange(
    path,
    { kind },
    DiffSelection.fromInitialSelection(DiffSelectionType.All)
  )

describe('compactDiffForCommitMessage', () => {
  it('returns small diffs unchanged', () => {
    const diff = fileDiff('src/a.ts', 5)
    assert.equal(compactDiffForCommitMessage(diff, 10_000), diff)
  })

  it('fits huge diffs in the budget and keeps every file named', () => {
    const raw =
      ':100644 100644 1111111 2222222 M\tsrc/big.ts\n:100644 100644 1111111 2222222 M\tsrc/small.ts\n:100644 100644 1111111 2222222 M\tyarn.lock\n'
    const diff =
      raw +
      fileDiff('src/big.ts', 20_000) +
      fileDiff('src/small.ts', 10) +
      fileDiff('yarn.lock', 5_000)

    for (const budget of RedAlertDiffBudgets) {
      const compact = compactDiffForCommitMessage(diff, budget)
      // A little slack for the per-file summary lines.
      assert.ok(compact.length <= budget * 1.1, `${compact.length} > ${budget}`)
      for (const path of ['src/big.ts', 'src/small.ts', 'yarn.lock']) {
        assert.ok(compact.includes(`diff --git a/${path} b/${path}`), path)
      }
      // The small file survives whole; the lockfile never takes space.
      assert.ok(compact.includes('+line 9'))
      assert.ok(compact.includes('generated file, diff omitted'))
    }
  })

  it('collapses binary files to their header', () => {
    const binary =
      'diff --git a/logo.png b/logo.png\nindex 1111111..2222222 100644\nBinary files a/logo.png and b/logo.png differ\n'
    const diff = binary + fileDiff('src/a.ts', 5_000)
    const compact = compactDiffForCommitMessage(diff, 6_000)
    assert.ok(compact.includes('diff --git a/logo.png b/logo.png'))
    assert.ok(compact.length <= 6_600)
  })
})

describe('fallbackCommitMessage', () => {
  it('names a single file', () => {
    const message = fallbackCommitMessage([
      file('src/new-thing.ts', AppFileStatusKind.New),
    ])
    assert.equal(message.summary, 'Add new-thing.ts')
    assert.equal(message.description, '')
  })

  it('lists a few files, and counts many', () => {
    const few = fallbackCommitMessage([
      file('a.ts', AppFileStatusKind.Modified),
      file('dir/b.ts', AppFileStatusKind.Deleted),
    ])
    assert.equal(few.summary, 'Update a.ts, b.ts')
    assert.equal(few.description, '- Update a.ts\n- Delete dir/b.ts')

    const many = fallbackCommitMessage(
      Array.from({ length: 25 }, (_, i) =>
        file(`f${i}.ts`, AppFileStatusKind.Modified)
      )
    )
    assert.equal(many.summary, 'Update 25 files')
    assert.ok(many.description.endsWith('- …and 5 more'))
  })
})
