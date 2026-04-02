import { autoUpdater } from 'electron-updater'
import { ipcMain, BrowserWindow, Menu } from 'electron'
import { COMMANDS } from '../../commands'
import { isOsx } from '../../config'

let runningUpdate = false
let win = null
let downloadedUpdateInfo = null
const selfUpdateEnabled = process.env.MARKTEXT_ENABLE_SELF_UPDATE === '1'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

autoUpdater.on('error', error => {
  if (win) {
    win.webContents.send('mt::UPDATE_ERROR', error === null ? 'Error: unknown' : (error.message || error).toString())
  }
})

autoUpdater.on('update-available', () => {
  if (win) {
    win.webContents.send('mt::UPDATE_AVAILABLE', 'Found an update, do you want download and install now?')
  }
  runningUpdate = false
})

autoUpdater.on('update-not-available', () => {
  if (win) {
    win.webContents.send('mt::UPDATE_NOT_AVAILABLE', 'Current version is up-to-date.')
  }
  runningUpdate = false
})

autoUpdater.on('update-downloaded', info => {
  downloadedUpdateInfo = info
  if (win) {
    const version = info && info.version ? info.version : 'the downloaded update'
    win.webContents.send('mt::UPDATE_DOWNLOADED', `Update ${version} downloaded. Review your unsaved work before installing.`)
  }
  runningUpdate = false
})

ipcMain.on('mt::NEED_UPDATE', (e, { needUpdate }) => {
  if (!selfUpdateEnabled) {
    const win = BrowserWindow.fromWebContents(e.sender)
    win.webContents.send('mt::UPDATE_DISABLED', 'Self-update is disabled for this build. Set MARKTEXT_ENABLE_SELF_UPDATE=1 to enable it.')
    runningUpdate = false
    return
  }
  if (needUpdate) {
    autoUpdater.downloadUpdate()
  } else {
    runningUpdate = false
  }
})

ipcMain.on('mt::INSTALL_UPDATE', () => {
  if (!selfUpdateEnabled || !downloadedUpdateInfo) {
    return
  }
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.on('mt::check-for-update', e => {
  const win = BrowserWindow.fromWebContents(e.sender)
  checkUpdates(win)
})

// --------------------------------------------------------

export const userSetting = () => {
  ipcMain.emit('app-create-settings-window')
}

export const checkUpdates = browserWindow => {
  if (!selfUpdateEnabled) {
    browserWindow.webContents.send('mt::UPDATE_DISABLED', 'Self-update is disabled for this build. Set MARKTEXT_ENABLE_SELF_UPDATE=1 to enable it.')
    return
  }
  if (!runningUpdate) {
    runningUpdate = true
    win = browserWindow
    autoUpdater.checkForUpdates()
  }
}

export const osxHide = () => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hide:')
  }
}

export const osxHideAll = () => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('hideOtherApplications:')
  }
}

export const osxShowAll = () => {
  if (isOsx) {
    Menu.sendActionToFirstResponder('unhideAllApplications:')
  }
}

// --- Commands -------------------------------------------------------------

export const loadMarktextCommands = commandManager => {
  commandManager.add(COMMANDS.MT_HIDE, osxHide)
  commandManager.add(COMMANDS.MT_HIDE_OTHERS, osxHideAll)
}
