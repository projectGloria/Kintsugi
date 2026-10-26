import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { _electron as electron, expect } from '@playwright/test'

const root = path.resolve(import.meta.dirname, '..')
const runDir = fs.mkdtempSync(path.join(root, '.tools', 'smoke-'))
const repo = path.join(runDir, 'repository')
fs.mkdirSync(repo)
const git = (...args) =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
git('init', '-b', 'main')
git('config', 'user.name', 'Kintsugi Test')
git('config', 'user.email', 'test@example.invalid')
fs.writeFileSync(path.join(repo, 'README.md'), '# Local test repository\n')
git('add', '.')
git('commit', '-m', 'Initial commit')
fs.writeFileSync(
  path.join(repo, 'smoke-change.txt'),
  'Kintsugi local commit test.\n'
)
const app = await electron.launch({
  executablePath: path.join(root, 'dist', 'Kintsugi-win32-x64', 'Kintsugi.exe'),
  args: [
    `--user-data-dir=${path.join(runDir, 'user-data')}`,
    `--cli-open=${repo}`,
  ],
  env: {
    ...process.env,
    KINTSUGI_TEST_MODE: '1',
    GIT_CONFIG_GLOBAL: path.join(runDir, '.gitconfig'),
    GIT_CONFIG_SYSTEM: path.join(runDir, '.gitconfig-system'),
  },
  timeout: 60_000,
})
try {
  const identity = await app.evaluate(({ app }) => ({
    name: app.getName(),
    version: app.getVersion(),
    data: app.getPath('userData'),
  }))
  assert.equal(identity.name, 'Kintsugi')
  assert.equal(identity.version, '0.1.0')
  assert.equal(path.resolve(identity.data), path.resolve(runDir, 'user-data'))
  const page = await app.firstWindow()
  page.setDefaultTimeout(30_000)
  const telemetry = []
  page.on('request', request => {
    if (
      /central\.github\.com\/api\/(usage|deployments)|cafe\.github\.com/.test(
        request.url()
      )
    ) {
      telemetry.push(request.url())
    }
  })
  await expect(page.locator('.welcome-title')).toContainText('Kintsugi')
  await expect(page.locator('.welcome-right img')).toHaveJSProperty(
    'naturalWidth',
    512
  )
  await page.screenshot({ path: path.join(runDir, 'welcome.png') })
  await page.locator('a.skip-button').click()
  await page.locator('input[placeholder="Your Name"]').fill('Kintsugi Test')
  await page
    .locator('input[placeholder="your-email@example.com"]')
    .fill('test@example.invalid')
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.locator('#welcome')).toBeHidden()
  await expect(
    page.locator('#desktop-app-title-bar img.app-icon')
  ).toHaveAttribute('alt', 'Kintsugi')
  const file = page.getByText('smoke-change.txt', { exact: true }).first()
  if (!(await file.isVisible().catch(() => false))) {
    const dialog = page.locator('dialog#add-existing-repository')
    if (!(await dialog.isVisible().catch(() => false))) {
      await page
        .getByText('Add an Existing Repository from your local drive', {
          exact: false,
        })
        .click()
    }
    await dialog.locator('input[placeholder="repository path"]').fill(repo)
    await dialog.getByRole('button', { name: /Add repository/i }).click()
  }
  const changedFile = page
    .getByText('smoke-change.txt', { exact: true })
    .first()
  await changedFile.click()
  await expect(page.locator('.diff-container')).toContainText(
    'Kintsugi local commit test.'
  )
  await page.locator('[aria-label="Create commit"] .commit-button').click()
  await expect
    .poll(() => git('log', '-1', '--pretty=%s'))
    .toBe('Create smoke-change.txt')
  assert.equal(git('status', '--porcelain'), '')
  await page.evaluate(() =>
    require('electron').ipcRenderer.emit('menu-event', {}, 'show-about')
  )
  await expect(page.locator('#about')).toContainText('About Kintsugi')
  await expect(page.locator('#about')).toContainText('Version 0.1.0')
  await expect(page.locator('#about')).toContainText(
    'Install newer versions manually.'
  )
  await expect(
    page.locator('#about').getByRole('button', { name: 'Check for Updates' })
  ).toHaveCount(0)
  await page.screenshot({ path: path.join(runDir, 'about.png') })
  assert.deepEqual(telemetry, [])
  fs.writeFileSync(
    path.join(runDir, 'result.json'),
    JSON.stringify(
      {
        passed: true,
        identity,
        checks: [
          'welcome branding',
          'icon',
          'repository diff',
          'commit',
          'about',
          'updates disabled',
          'no usage requests',
        ],
      },
      null,
      2
    )
  )
  console.log(`Kintsugi smoke test passed. Evidence: ${runDir}`)
} catch (error) {
  const page = await app.firstWindow().catch(() => null)
  await page
    ?.screenshot({ path: path.join(runDir, 'failure.png') })
    .catch(() => {})
  if (page)
    fs.writeFileSync(
      path.join(runDir, 'failure.html'),
      await page.content().catch(() => '')
    )
  console.error(`Evidence: ${runDir}`)
  throw error
} finally {
  await app.close()
}
