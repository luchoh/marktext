import { BrowserWindow, ipcMain, Menu, MenuItem } from 'electron'

const getBrowserWindow = sender => BrowserWindow.fromWebContents(sender)

const getWindowState = win => ({
  isFullScreen: win.isFullScreen(),
  isMaximized: win.isMaximized()
})

const popupMenu = (menu, win, x, y) => {
  return new Promise(resolve => {
    let selectedId = null

    menu.items.forEach(item => {
      const originalClick = item.click
      item.click = (...args) => {
        selectedId = item.id || null
        if (originalClick) {
          originalClick(...args)
        }
      }
    })

    menu.popup({
      window: win,
      x,
      y,
      callback: () => resolve(selectedId)
    })
  })
}

const buildMenu = items => {
  const menu = new Menu()
  items.forEach(item => {
    menu.append(new MenuItem(item))
  })
  return menu
}

const createTabsContextMenu = pathname => buildMenu([
  { id: 'closeThisTab', label: 'Close' },
  { id: 'closeOtherTabs', label: 'Close others' },
  { id: 'closeSavedTabs', label: 'Close saved tabs' },
  { id: 'closeAllTabs', label: 'Close all tabs' },
  { type: 'separator' },
  { id: 'renameFile', label: 'Rename', enabled: !!pathname },
  { id: 'copyPath', label: 'Copy path', enabled: !!pathname },
  { id: 'showInFolder', label: 'Show in folder', enabled: !!pathname }
])

const createSidebarContextMenu = hasPathCache => buildMenu([
  { id: 'newFileMenuItem', label: 'New File' },
  { id: 'newDirectoryMenuItem', label: 'New Directory' },
  { type: 'separator' },
  { id: 'copyMenuItem', label: 'Copy' },
  { id: 'cutMenuItem', label: 'Cut' },
  { id: 'pasteMenuItem', label: 'Paste', enabled: !!hasPathCache },
  { type: 'separator' },
  { id: 'renameMenuItem', label: 'Rename' },
  { id: 'deleteMenuItem', label: 'Move To Trash' },
  { type: 'separator' },
  { id: 'showInFolderMenuItem', label: 'Show In Folder' }
])

const setupBridgeIpc = () => {
  ipcMain.handle('mt::bridge-window-state', event => {
    const win = getBrowserWindow(event.sender)
    return getWindowState(win)
  })

  ipcMain.handle('mt::bridge-window-action', (event, action) => {
    const win = getBrowserWindow(event.sender)

    switch (action) {
      case 'close':
        win.close()
        break
      case 'minimize':
        win.minimize()
        break
      case 'toggle-maximize':
        if (win.isFullScreen()) {
          win.setFullScreen(false)
        } else if (win.isMaximized()) {
          win.unmaximize()
        } else {
          win.maximize()
        }
        break
      case 'toggle-fullscreen':
        win.setFullScreen(!win.isFullScreen())
        break
    }

    return getWindowState(win)
  })

  ipcMain.handle('mt::bridge-show-application-menu', async (event, { x, y }) => {
    const win = getBrowserWindow(event.sender)
    const menu = Menu.getApplicationMenu()
    if (menu) {
      menu.popup({ window: win, x, y })
    }
    return null
  })

  ipcMain.handle('mt::bridge-show-tabs-context-menu', async (event, { x, y, pathname }) => {
    const win = getBrowserWindow(event.sender)
    return popupMenu(createTabsContextMenu(pathname), win, x, y)
  })

  ipcMain.handle('mt::bridge-show-sidebar-context-menu', async (event, { x, y, hasPathCache }) => {
    const win = getBrowserWindow(event.sender)
    return popupMenu(createSidebarContextMenu(hasPathCache), win, x, y)
  })
}

export default setupBridgeIpc
