import path from 'path'
import dayjs from 'dayjs'
import { isImageFile } from '../../common/filesystem/paths'
import { isWindows } from './index'

const serializeImage = async image => {
  if (typeof image === 'string') {
    return {
      kind: 'path',
      value: image
    }
  }

  const fallbackName = image.name || `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.png`
  const bytes = Array.from(new Uint8Array(await image.arrayBuffer()))
  return {
    bytes,
    kind: 'buffer',
    name: fallbackName,
    size: image.size,
    type: image.type
  }
}

export const create = (pathname, type) => {
  return window.mt.fileSystem.create(pathname, type)
}

export const paste = clipboard => {
  return window.mt.fileSystem.paste(clipboard)
}

export const rename = (src, dest) => {
  return window.mt.fileSystem.rename(src, dest)
}

export const moveToRelativeFolder = async (cwd, relativeName, filePath, imagePath) => {
  return window.mt.fileSystem.moveToRelativeFolder(cwd, relativeName, filePath, imagePath)
}

export const moveImageToFolder = async (pathname, image, outputDir) => {
  const serializedImage = await serializeImage(image)
  return window.mt.fileSystem.moveImageToFolder(pathname, serializedImage, outputDir)
}

export const uploadImage = async (pathname, image, preferences) => {
  const serializedImage = await serializeImage(image)
  return window.mt.fileSystem.uploadImage(pathname, serializedImage, preferences)
}

export const isFileExecutableSync = filepath => {
  return window.mt.fileSystem.isFileExecutableSync(filepath)
}

// Preserve a stable filename for pasted file objects to keep existing image names readable.
export const getPastedImageFilename = image => {
  if (typeof image === 'string') {
    const filename = path.basename(image)
    return filename || `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.png`
  }

  return image.name || `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}.png`
}

export const isSafeLocalImagePath = imagePath => {
  if (!imagePath || typeof imagePath !== 'string') {
    return false
  }
  return isImageFile(imagePath) && (!isWindows || !imagePath.startsWith('\\\\'))
}
