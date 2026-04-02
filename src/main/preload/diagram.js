import zlib from 'zlib'

const PLANTUML_URL = 'https://www.plantuml.com/plantuml'

const replaceChar = (tableIn, tableOut, char) => {
  const charIndex = tableIn.indexOf(char)
  return tableOut[charIndex]
}

const maketrans = (tableIn, tableOut, value) => {
  return [...value].map(i => replaceChar(tableIn, tableOut, i)).join('')
}

export const createPlantUmlSvgUrl = value => {
  const tableIn =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const tableOut =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

  const utf8Value = decodeURIComponent(encodeURIComponent(value))
  const compressedValue = zlib.deflateSync(utf8Value, { level: 3 })
  const base64Value = compressedValue.toString('base64')
  const encodedInput = maketrans(tableIn, tableOut, base64Value)
  return `${PLANTUML_URL}/svg/~1${encodedInput}`
}
