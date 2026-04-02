const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron } = require('playwright')

const mainEntrypoint = 'dist/electron/main.js'

const getTempPath = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2etest-'))
}

const getElectronPath = () => {
  const launcherName = process.platform === 'win32' ? 'electron.cmd' : 'electron'
  return path.resolve(path.join('node_modules', '.bin', launcherName))
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const launchElectron = async userArgs => {
  userArgs = userArgs || []
  const executablePath = getElectronPath()
  const args = [mainEntrypoint, '--user-data-dir', getTempPath()].concat(userArgs)
  const app = await _electron.launch({
    executablePath,
    args,
    timeout: 30000
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { app, page }
}

const closeElectron = async app => {
  if (!app) return

  const child = app.process()
  try {
    await Promise.race([
      app.close(),
      wait(5000).then(() => {
        throw new Error('Timed out while closing Electron app')
      })
    ])
  } catch (error) {
    if (child && child.exitCode === null && !child.killed) {
      child.kill('SIGKILL')
      await wait(250)
      return
    }
    throw error
  }
}

module.exports = { closeElectron, getElectronPath, launchElectron }
