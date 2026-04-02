import * as contextMenu from './actions'

export const showContextMenu = async (event, tab) => {
  const { pathname } = tab
  const action = await window.mt.menu.popupTabsContext({
    pathname,
    x: event.clientX,
    y: event.clientY
  })

  switch (action) {
    case 'closeThisTab':
      contextMenu.closeThis(tab.id)
      break
    case 'closeOtherTabs':
      contextMenu.closeOthers(tab.id)
      break
    case 'closeSavedTabs':
      contextMenu.closeSaved()
      break
    case 'closeAllTabs':
      contextMenu.closeAll()
      break
    case 'renameFile':
      contextMenu.rename(tab.id)
      break
    case 'copyPath':
      contextMenu.copyPath(tab.id)
      break
    case 'showInFolder':
      contextMenu.showInFolder(tab.id)
      break
  }
}
