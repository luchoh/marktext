import * as contextMenu from './actions'

export const showContextMenu = async (event, hasPathCache) => {
  const action = await window.mt.menu.popupSidebarContext({
    hasPathCache,
    x: event.clientX,
    y: event.clientY
  })

  switch (action) {
    case 'newFileMenuItem':
      contextMenu.newFile()
      break
    case 'newDirectoryMenuItem':
      contextMenu.newDirectory()
      break
    case 'copyMenuItem':
      contextMenu.copy()
      break
    case 'cutMenuItem':
      contextMenu.cut()
      break
    case 'pasteMenuItem':
      contextMenu.paste()
      break
    case 'renameMenuItem':
      contextMenu.rename()
      break
    case 'deleteMenuItem':
      contextMenu.remove()
      break
    case 'showInFolderMenuItem':
      contextMenu.showInFolder()
      break
  }
}
