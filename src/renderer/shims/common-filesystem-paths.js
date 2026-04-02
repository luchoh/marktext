import path from 'path'

export const MARKDOWN_EXTENSIONS = Object.freeze([
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
])

export const MARKDOWN_INCLUSIONS = Object.freeze(MARKDOWN_EXTENSIONS.map(x => `*.${x}`))

export const IMAGE_EXTENSIONS = Object.freeze([
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
])

export const hasMarkdownExtension = filename => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(`.${ext}`))
}

export const isImageFile = filepath => {
  const extname = path.extname(filepath)
  return window.mt.fileSystem.isFile(filepath) && IMAGE_EXTENSIONS.some(ext => {
    const extReg = new RegExp(ext, 'i')
    return extReg.test(extname)
  })
}

export const isMarkdownFile = filepath => {
  return window.mt.fileSystem.isFile(filepath) && hasMarkdownExtension(filepath)
}

export const isSamePathSync = (pathA, pathB) => window.mt.fileSystem.isSamePathSync(pathA, pathB)

export const isChildOfDirectory = (dir, child) => {
  if (!dir || !child) return false
  const relative = path.relative(dir, child)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const getResourcesPath = () => window.mt.env.paths.resourcesPath
