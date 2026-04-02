import path from 'path'
import plist from 'plist'
import { clipboard, contextBridge, ipcRenderer, shell, webFrame } from 'electron'
import EnvPaths from 'common/envPaths'
import {
  commandExistsSync,
  create,
  getAvailableFontsSync,
  isDirectorySync,
  isFileExecutableSync,
  isFileSync,
  isSamePathSync,
  isSymbolicLinkSync,
  listExportThemes,
  moveImageToFolder,
  moveToRelativeFolder,
  paste,
  readExportTheme,
  rename,
  uploadImage
} from './filesystem'
import { searchFiles, searchText } from './search'

const RECEIVE_CHANNELS = [
  'mt::UPDATE_AVAILABLE',
  'mt::UPDATE_DISABLED',
  'mt::UPDATE_DOWNLOADED',
  'mt::UPDATE_ERROR',
  'mt::UPDATE_NOT_AVAILABLE',
  'mt::about-dialog',
  'mt::ask-for-close',
  'mt::bootstrap-editor',
  'mt::cm-copy-as-html',
  'mt::cm-copy-as-markdown',
  'mt::cm-insert-paragraph',
  'mt::cm-paste-as-plain-text',
  'mt::editor-ask-file-save',
  'mt::editor-ask-file-save-as',
  'mt::editor-close-tab',
  'mt::editor-edit-action',
  'mt::editor-format-action',
  'mt::editor-move-file',
  'mt::editor-paragraph-action',
  'mt::editor-rename-file',
  'mt::execute-command-by-id',
  'mt::export-success',
  'mt::force-close-tabs-by-id',
  'mt::invalidate-image-cache',
  'mt::keybindings-response',
  'mt::new-untitled-tab',
  'mt::open-directory',
  'mt::open-new-tab',
  'mt::pandoc-not-exists',
  'mt::print-service-clearup',
  'mt::response-of-image-path',
  'mt::save-path-selected',
  'mt::screenshot-captured',
  'mt::set-file-encoding',
  'mt::set-final-newline',
  'mt::set-line-ending',
  'mt::set-pathname',
  'mt::set-view-layout',
  'mt::show-command-palette',
  'mt::show-export-dialog',
  'mt::show-notification',
  'mt::spelling-replace-misspelling',
  'mt::spelling-show-switch-language',
  'mt::switch-tab-by-index',
  'mt::tab-save-failure',
  'mt::tab-saved',
  'mt::tabs-cycle-left',
  'mt::tabs-cycle-right',
  'mt::toggle-view-layout-entry',
  'mt::toggle-view-mode-entry',
  'mt::tweet',
  'mt::update-file',
  'mt::update-object-tree',
  'mt::user-preference',
  'mt::window-active-status',
  'mt::window-enter-full-screen',
  'mt::window-leave-full-screen',
  'mt::window-maximize',
  'mt::window-unmaximize',
  'mt::window-zoom',
  'settings::change-tab'
]

const SEND_CHANNEL_REG = /^mt::/

const createPaths = userDataPath => {
  const paths = new EnvPaths(userDataPath)
  const resourcesPath = process.resourcesPath
  return Object.freeze({
    dataCenterPath: paths.dataCenterPath,
    logPath: paths.logPath,
    preferencesPath: paths.preferencesPath,
    resourcesPath,
    userDataPath: paths.userDataPath
  })
}

const parseUrlArgs = () => {
  const params = new URLSearchParams(window.location.search)
  const userDataPath = params.get('udp')
  const windowId = Number(params.get('wid'))
  return {
    debug: params.get('debug') === '1',
    initialState: Object.freeze({
      codeFontFamily: params.get('cff'),
      codeFontSize: params.get('cfs'),
      hideScrollbar: params.get('hsb') === '1',
      theme: params.get('theme'),
      titleBarStyle: params.get('tbs')
    }),
    paths: createPaths(userDataPath),
    platform: process.platform,
    type: params.get('type'),
    userDataPath,
    windowId,
    appVersion: global.MARKTEXT_VERSION_STRING || ''
  }
}

const env = Object.freeze(parseUrlArgs())

const assertChannel = channel => {
  if (!SEND_CHANNEL_REG.test(channel)) {
    throw new Error(`Blocked bridge IPC channel: ${channel}`)
  }
}

const dispatchRendererEvent = (channel, args) => {
  window.dispatchEvent(new CustomEvent('__mt-ipc__', {
    detail: { channel, args }
  }))
}

for (const channel of RECEIVE_CHANNELS) {
  ipcRenderer.on(channel, (_event, ...args) => {
    dispatchRendererEvent(channel, args)
  })
}

const guessClipboardFilePath = () => {
  if (process.platform === 'linux') return ''
  if (process.platform === 'darwin') {
    if (!clipboard.has('NSFilenamesPboardType')) {
      return ''
    }
    const result = plist.parse(clipboard.read('NSFilenamesPboardType'))
    return Array.isArray(result) && result.length ? result[0] : ''
  }
  if (process.platform === 'win32') {
    const rawFilePath = clipboard.read('FileNameW')
    const filePath = rawFilePath.replace(new RegExp(String.fromCharCode(0), 'g'), '')
    return filePath && typeof filePath === 'string' ? filePath : ''
  }
  return ''
}

const getResourcesPath = () => {
  let resPath = process.resourcesPath
  if (process.env.NODE_ENV === 'development') {
    if (process.platform === 'darwin') {
      resPath = path.join(resPath, '../..')
    }
    resPath = path.join(resPath, '../../../../resources')
  }
  return resPath
}

const isUpdatable = () => {
  const resPath = getResourcesPath()
  const updaterConfig = path.join(resPath, 'app-update.yml')
  if (!isFileSync(updaterConfig)) {
    return false
  }
  if (process.env.APPIMAGE) {
    return true
  }
  return process.platform === 'win32' && isFileSync(path.join(resPath, 'md.ico'))
}

contextBridge.exposeInMainWorld('mt', {
  app: {
    isSelfUpdateEnabled: () => process.env.MARKTEXT_ENABLE_SELF_UPDATE === '1',
    isUpdatable
  },
  clipboard: {
    guessFilePath: guessClipboardFilePath,
    has: format => clipboard.has(format),
    read: format => clipboard.read(format),
    readText: () => clipboard.readText(),
    writeText: text => clipboard.writeText(text)
  },
  env,
  fileSystem: {
    commandExistsSync,
    create,
    getAvailableFontsSync,
    isDirectory: isDirectorySync,
    isFile: isFileSync,
    isFileExecutableSync,
    isSamePathSync,
    isSymbolicLink: isSymbolicLinkSync,
    listExportThemes: () => listExportThemes(env.paths.userDataPath),
    moveImageToFolder,
    moveToRelativeFolder: (cwd, relativeName, filePath, imagePath) => moveToRelativeFolder(cwd, relativeName, filePath, imagePath, process.platform === 'win32'),
    paste,
    readExportTheme: theme => readExportTheme(env.paths.userDataPath, theme),
    rename,
    uploadImage
  },
  ipc: {
    invoke: (channel, ...args) => {
      assertChannel(channel)
      return ipcRenderer.invoke(channel, ...args)
    },
    send: (channel, ...args) => {
      assertChannel(channel)
      ipcRenderer.send(channel, ...args)
    }
  },
  menu: {
    popupApplication: (x, y) => ipcRenderer.invoke('mt::bridge-show-application-menu', { x, y }),
    popupSidebarContext: state => ipcRenderer.invoke('mt::bridge-show-sidebar-context-menu', state),
    popupTabsContext: state => ipcRenderer.invoke('mt::bridge-show-tabs-context-menu', state)
  },
  search: {
    searchFiles,
    searchText
  },
  shell: {
    openExternal: url => shell.openExternal(url),
    openPath: pathname => shell.openPath(pathname),
    showItemInFolder: pathname => shell.showItemInFolder(pathname)
  },
  webFrame: {
    setZoomFactor: zoomFactor => webFrame.setZoomFactor(zoomFactor)
  },
  window: {
    getState: () => ipcRenderer.invoke('mt::bridge-window-state'),
    perform: action => ipcRenderer.invoke('mt::bridge-window-action', action)
  }
})
