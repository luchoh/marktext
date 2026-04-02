import { sanitize, isValidAttribute } from 'dompurify'

const isPlainObject = value => Object.prototype.toString.call(value) === '[object Object]'

const cloneSanitizeOption = value => {
  if (Array.isArray(value)) {
    return value.map(cloneSanitizeOption)
  }

  if (isPlainObject(value)) {
    const clean = Object.create(null)
    for (const key of Object.keys(value)) {
      clean[key] = cloneSanitizeOption(value[key])
    }
    return clean
  }

  return value
}

const normalizeSanitizeOptions = options => {
  if (!options || typeof options !== 'object') {
    return options
  }

  return cloneSanitizeOption(options)
}

export { isValidAttribute }

export default (dirty, options) => sanitize(dirty, normalizeSanitizeOptions(options))
