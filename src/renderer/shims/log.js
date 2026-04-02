const noop = () => {}

const log = {
  transports: {
    console: {},
    file: {},
    mainConsole: null,
    rendererConsole: null
  },
  debug: (...args) => console.debug(...args),
  error: (...args) => console.error(...args),
  info: (...args) => console.info(...args),
  log: (...args) => console.log(...args),
  silly: (...args) => console.debug(...args),
  verbose: (...args) => console.debug(...args),
  warn: (...args) => console.warn(...args)
}

log.transports.file.resolvePath = noop

export default log
