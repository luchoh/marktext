import commandExists from 'command-exists'
import { Octokit } from '@octokit/rest'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import fsPromises from 'fs/promises'
import { statSync, constants } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import crypto from 'crypto'
import cp from 'child_process'
import { isDirectory, isFile, isSymbolicLink } from 'common/filesystem'

const IMAGE_EXTENSIONS = Object.freeze([
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
])

const isImageFile = filepath => {
  const extname = path.extname(filepath)
  return isFile(filepath) && IMAGE_EXTENSIONS.some(ext => {
    const extReg = new RegExp(ext, 'i')
    return extReg.test(extname)
  })
}

const serializeBytes = input => {
  if (Array.isArray(input)) {
    return Buffer.from(input)
  }

  if (ArrayBuffer.isView(input)) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength)
  }

  return Buffer.from(input || [])
}

export const create = async (pathname, type) => {
  return type === 'directory'
    ? fs.ensureDir(pathname)
    : fs.outputFile(pathname, '')
}

export const paste = async ({ src, dest, type }) => {
  return type === 'cut'
    ? fs.move(src, dest)
    : fs.copy(src, dest)
}

export const rename = async (src, dest) => {
  return fs.move(src, dest)
}

export const moveToRelativeFolder = async (cwd, relativeName, filePath, imagePath, isWindows) => {
  if (!relativeName) {
    relativeName = 'assets'
  } else if (path.isAbsolute(relativeName)) {
    throw new Error('Invalid relative directory name.')
  }

  const absPath = path.resolve(cwd, relativeName)
  const dstPath = path.resolve(absPath, path.basename(imagePath))
  await fs.ensureDir(absPath)
  await fs.move(imagePath, dstPath, { overwrite: true })

  const dstRelPath = path.relative(path.dirname(filePath), dstPath)
  return isWindows ? dstRelPath.replace(/\\/g, '/') : dstRelPath
}

const getContentHash = content => crypto.createHash('sha1').update(content, 'utf8').digest('hex')

export const moveImageToFolder = async (pathname, image, outputDir) => {
  await fs.ensureDir(outputDir)

  if (image.kind === 'path') {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image.value)
    if (!isImageFile(imagePath)) {
      return image.value
    }

    const filename = path.basename(imagePath)
    const extname = path.extname(imagePath)
    const noHashPath = path.join(outputDir, filename)
    if (noHashPath === imagePath) {
      return imagePath
    }

    const hashPath = path.join(outputDir, `${getContentHash(imagePath)}${extname}`)
    await fs.copy(imagePath, hashPath)
    return hashPath
  }

  const imagePath = path.join(outputDir, `${dayjs().format('YYYY-MM-DD-HH-mm-ss')}-${image.name}`)
  await fs.writeFile(imagePath, serializeBytes(image.bytes))
  return imagePath
}

export const uploadImage = async (pathname, image, preferences) => {
  const { currentUploader, imageBed, githubToken: auth, cliScript } = preferences
  const { owner, repo, branch } = imageBed.github
  const maxSize = 5 * 1024 * 1024

  const uploadByGithub = (content, filename) => {
    const octokit = new Octokit({ auth })
    const assetPath = `${dayjs().format('YYYY/MM')}/${dayjs().format('DD-HH-mm-ss')}-${filename}`
    const message = `Upload by MarkText at ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`
    const payload = { owner, repo, path: assetPath, branch, message, content }
    if (!branch) {
      delete payload.branch
    }

    return octokit.repos.createOrUpdateFileContents(payload)
      .then(result => result.data.content.download_url)
      .catch(() => {
        throw new Error('Upload failed, the image will be copied to the image folder')
      })
  }

  const uploadByCommand = async (uploader, input) => {
    let filepath = input
    let removeTempFile = false
    if (typeof filepath !== 'string') {
      filepath = path.join(tmpdir(), `${Date.now()}`)
      await fs.writeFile(filepath, serializeBytes(input.bytes))
      removeTempFile = true
    }

    const execPromise = new Promise((resolve, reject) => {
      const cb = async (err, data) => {
        if (removeTempFile) {
          await fs.unlink(filepath).catch(() => {})
        }
        if (err) {
          return reject(err)
        }
        resolve(data.trim())
      }

      if (uploader === 'picgo') {
        cp.exec(`picgo u "${filepath}"`, async (err, data) => {
          if (removeTempFile) {
            await fs.unlink(filepath).catch(() => {})
          }
          if (err) {
            return reject(err)
          }
          const parts = data.split('[PicGo SUCCESS]:')
          if (parts.length === 2) {
            resolve(parts[1].trim())
          } else {
            reject(new Error('PicGo upload error'))
          }
        })
      } else {
        cp.execFile(cliScript, [filepath], cb)
      }
    })

    return execPromise
  }

  if (currentUploader === 'none') {
    throw new Error('No image uploader provided.')
  }

  if (image.kind === 'path') {
    const dirname = path.dirname(pathname)
    const imagePath = path.resolve(dirname, image.value)
    if (!isImageFile(imagePath)) {
      return image.value
    }

    const { size } = await fs.stat(imagePath)
    if (size > maxSize) {
      throw new Error('Cannot upload more than 5M image, the image will be copied to the image folder')
    }

    switch (currentUploader) {
      case 'cliScript':
      case 'picgo':
        return uploadByCommand(currentUploader, imagePath)
      case 'github': {
        const imageFile = await fs.readFile(imagePath)
        return uploadByGithub(Buffer.from(imageFile).toString('base64'), path.basename(imagePath))
      }
      default:
        return image.value
    }
  }

  if (image.size > maxSize) {
    throw new Error('Cannot upload more than 5M image, the image will be copied to the image folder')
  }

  switch (currentUploader) {
    case 'cliScript':
    case 'picgo':
      return uploadByCommand(currentUploader, image)
    default:
      return uploadByGithub(Buffer.from(image.bytes).toString('base64'), image.name)
  }
}

export const isFileExecutableSync = filepath => {
  try {
    const stat = statSync(filepath)
    return stat.isFile() && (stat.mode & (constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH)) !== 0
  } catch (_) {
    return false
  }
}

export const listExportThemes = async userDataPath => {
  const themeDir = path.join(userDataPath, 'themes/export')
  if (!isDirectory(themeDir)) {
    return []
  }

  const entries = await fsPromises.readdir(themeDir)
  const themes = await Promise.all(entries.map(async filename => {
    const fullname = path.join(themeDir, filename)
    if (!/.+\.css$/i.test(filename) || !isFile(fullname)) {
      return null
    }

    const content = await fsPromises.readFile(fullname, 'utf8')
    const match = content.match(/^(?:\/\*+[ \t]*([A-z0-9 -]+)[ \t]*(?:\*+\/|[\n\r])?)/)
    return {
      value: filename,
      label: match && match[1] ? match[1] : filename
    }
  }))

  return themes.filter(Boolean)
}

export const readExportTheme = (userDataPath, theme) => {
  const themePath = path.join(userDataPath, 'themes/export', theme)
  if (!isFile(themePath)) {
    return ''
  }
  return fs.readFileSync(themePath, 'utf8')
}

export const commandExistsSync = command => commandExists.sync(command)

export const getAvailableFontsSync = onlyMonospace => {
  const fontManager = require('fontmanager-redux')
  return fontManager.getAvailableFontsSync()
    .filter(font => font.family && (!onlyMonospace || font.monospace))
}

export const isSamePathSync = (pathA, pathB) => {
  if (!pathA || !pathB) return false
  const normalizedA = path.normalize(pathA)
  const normalizedB = path.normalize(pathB)
  if (normalizedA.length !== normalizedB.length) {
    return false
  }
  if (normalizedA === normalizedB) {
    return true
  }
  if (normalizedA.toLowerCase() === normalizedB.toLowerCase()) {
    try {
      const fiA = fs.statSync(normalizedA)
      const fiB = fs.statSync(normalizedB)
      return fiA.ino === fiB.ino
    } catch (_) {
      return false
    }
  }
  return false
}

export const isFileSync = filepath => isFile(filepath)
export const isDirectorySync = dirPath => isDirectory(dirPath)
export const isSymbolicLinkSync = filepath => isSymbolicLink(filepath)
