import Vue from 'vue'
Vue.config.devtools = false
Vue.config.productionTip = false

const resolved = Promise.resolve()

window.mt = {
  env: {
    platform: 'darwin',
    appVersion: 'test',
    debug: false,
    initialState: {},
    windowId: 1,
    type: 'editor',
    paths: {
      logPath: '/tmp',
      resourcesPath: '/tmp'
    }
  },
  shell: {
    openExternal: () => resolved,
    openPath: () => resolved
  },
  clipboard: {
    readText: () => '',
    writeText: () => {}
  },
  diagram: {
    createPlantUmlSvgUrl: () => 'https://www.plantuml.com/plantuml/svg/~1TEST'
  },
  webFrame: {
    setZoomLevel: () => {},
    setZoomFactor: () => {},
    getZoomFactor: () => 1
  },
  ipc: {
    send: () => {},
    invoke: () => resolved
  },
  app: {
    isUpdatable: () => false
  },
  window: {
    perform: () => resolved,
    getState: () => Promise.resolve({
      isFullScreen: false,
      isMaximized: false
    })
  },
  menu: {
    popupApplication: () => resolved,
    popupSidebarContext: () => resolved,
    popupTabsContext: () => resolved
  },
  search: {
    searchFiles: () => Promise.resolve([]),
    searchText: () => Promise.resolve([])
  },
  fileSystem: {
    commandExistsSync: () => false,
    create: () => resolved,
    paste: () => resolved,
    rename: () => resolved,
    moveToRelativeFolder: () => resolved,
    moveImageToFolder: () => resolved,
    uploadImage: () => resolved,
    isFileExecutableSync: () => false,
    listExportThemes: () => Promise.resolve([]),
    readExportTheme: () => '',
    getAvailableFontsSync: () => [],
    isFile: () => false,
    isDirectory: () => false,
    isSymbolicLink: () => false,
    isSamePathSync: (pathA, pathB) => pathA === pathB
  }
}

// require all test files (files that ends with .spec.js)
const testsContext = require.context('./specs', true, /\.spec$/)
testsContext.keys().forEach(testsContext)

// require all src files except main.js for coverage.
// you can also change this to match only the subset of files that
// you want coverage for.
const srcContext = require.context('../../src/renderer', true, /^\.\/(?!main(\.js)?$).+\.(?:js|vue)$/)
srcContext.keys().forEach(srcContext)
