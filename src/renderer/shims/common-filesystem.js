export const exists = async p => {
  return window.mt.fileSystem.isFile(p) || window.mt.fileSystem.isDirectory(p) || window.mt.fileSystem.isSymbolicLink(p)
}

export const ensureDirSync = () => {
  throw new Error('Renderer filesystem shim does not support ensureDirSync.')
}

export const isDirectory = dirPath => window.mt.fileSystem.isDirectory(dirPath)
export const isDirectory2 = dirPath => window.mt.fileSystem.isDirectory(dirPath)
export const isFile = filepath => window.mt.fileSystem.isFile(filepath)
export const isFile2 = filepath => window.mt.fileSystem.isFile(filepath)
export const isSymbolicLink = filepath => window.mt.fileSystem.isSymbolicLink(filepath)
