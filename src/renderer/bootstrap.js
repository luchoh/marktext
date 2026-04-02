import path from 'path-browserify'
import { ipcRenderer } from '@/shims/electron'
import log from 'electron-log'

let exceptionLogger = s => console.error(s)

const configureLogger = () => {
  const { debug, paths, windowId } = globalThis.marktext.env
  log.transports.console.level = process.env.NODE_ENV === 'development' ? 'info' : false // mirror to window console
  log.transports.mainConsole = null
  log.transports.file.resolvePath = () => path.join(paths.logPath, `editor-${windowId}.log`)
  log.transports.file.level = debug ? 'debug' : 'info'
  log.transports.file.sync = false
  exceptionLogger = log.error
}

const parseUrlArgs = () => {
  return window.mt.env
}

const bootstrapRenderer = () => {
  // Register renderer exception handler
  window.addEventListener('error', event => {
    if (event.error) {
      const { message, name, stack } = event.error
      const copy = {
        message,
        name,
        stack
      }

      exceptionLogger(event.error)

      // Pass exception to main process exception handler to show a error dialog.
      ipcRenderer.send('mt::handle-renderer-error', copy)
    } else {
      console.error(event)
    }
  })

  const {
    debug,
    initialState,
    windowId,
    type,
    paths
  } = parseUrlArgs()
  const marktext = {
    initialState,
    env: {
      debug,
      paths,
      windowId,
      type
    },
    paths
  }
  globalThis.marktext = marktext

  configureLogger()
}

export default bootstrapRenderer
