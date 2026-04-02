import { spawn } from 'child_process'
import path from 'path'
import { rgPath } from 'vscode-ripgrep'

const rgDiskPath = rgPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked')

const getRipgrepPath = () => {
  return process.env.MARKTEXT_RIPGREP_PATH || rgDiskPath
}

const getText = input => {
  return 'text' in input ? input.text : Buffer.from(input.bytes, 'base64').toString()
}

const cleanResultLine = resultLine => {
  resultLine = getText(resultLine)
  return resultLine[resultLine.length - 1] === '\n' ? resultLine.slice(0, -1) : resultLine
}

const getPositionFromColumn = (lines, column) => {
  let currentLength = 0
  let currentLine = 0
  let previousLength = 0

  while (column >= currentLength) {
    previousLength = currentLength
    currentLength += lines[currentLine].length + 1
    currentLine++
  }

  return [currentLine - 1, column - previousLength]
}

const processUnicodeMatch = match => {
  const text = getText(match.lines)
  if (text.length === Buffer.byteLength(text)) {
    return
  }

  let remainingBuffer = Buffer.from(text)
  let currentLength = 0
  let previousPosition = 0

  const convertPosition = position => {
    const currentBuffer = remainingBuffer.slice(0, position - previousPosition)
    currentLength = currentBuffer.toString().length + currentLength
    remainingBuffer = remainingBuffer.slice(position - previousPosition)
    previousPosition = position
    return currentLength
  }

  for (const submatch of match.submatches) {
    submatch.start = convertPosition(submatch.start)
    submatch.end = convertPosition(submatch.end)
  }
}

const processSubmatch = (submatch, lineText, offsetRow) => {
  const lineParts = lineText.split('\n')
  const start = getPositionFromColumn(lineParts, submatch.start)
  const end = getPositionFromColumn(lineParts, submatch.end)

  for (let i = start[0]; i > 0; i--) {
    lineParts.shift()
  }
  while (end[0] < lineParts.length - 1) {
    lineParts.pop()
  }

  start[0] += offsetRow
  end[0] += offsetRow

  return {
    range: [start, end],
    lineText: cleanResultLine({ text: lineParts.join('\n') })
  }
}

const prepareGlobs = (globs, projectRootPath) => {
  const output = []

  for (let pattern of globs) {
    pattern = pattern.replace(new RegExp(`\\${path.sep}`, 'g'), '/')
    if (pattern.length === 0) {
      continue
    }

    const projectName = path.basename(projectRootPath)
    if (pattern === projectName) {
      output.push('**/*')
      continue
    }

    if (pattern.startsWith(projectName + '/')) {
      pattern = pattern.slice(projectName.length + 1)
    }

    if (pattern.endsWith('/')) {
      pattern = pattern.slice(0, -1)
    }

    pattern = pattern.startsWith('**/') ? pattern : `**/${pattern}`
    output.push(pattern)
    output.push(pattern.endsWith('/**') ? pattern : `${pattern}/**`)
  }

  return output
}

const prepareRegexp = regexpStr => {
  if (regexpStr === '--') {
    return '\\-\\-'
  }

  return regexpStr.replace(/\\\//g, '/')
}

const isMultilineRegexp = regexpStr => regexpStr.includes('\\n')

export const searchFiles = (directoryPath, inclusions = [], options = {}) => {
  const args = ['--files']
  if (options.followSymlinks) args.push('--follow')
  if (options.includeHidden) args.push('--hidden')
  if (options.noIgnore) args.push('--no-ignore')

  for (const inclusion of prepareGlobs(inclusions, directoryPath)) {
    args.push('--iglob', inclusion)
  }

  args.push('--', directoryPath)

  return new Promise((resolve, reject) => {
    let buffer = ''
    let bufferError = ''
    const results = []
    const child = spawn(getRipgrepPath(), args, {
      cwd: directoryPath,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    child.on('close', code => {
      if (code !== null && code > 1) {
        reject(new Error(bufferError))
      } else {
        resolve(results)
      }
    })
    child.on('error', reject)

    child.stderr.on('data', chunk => {
      bufferError += chunk
    })

    child.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line) continue
        results.push(line)
        if (results.length > 30) {
          child.kill()
          break
        }
      }
    })
  })
}

export const searchText = (directoryPath, pattern, options = {}) => {
  let regexpStr = null
  let textPattern = null
  const args = ['--json']

  if (options.isRegexp) {
    regexpStr = prepareRegexp(pattern)
    args.push('--regexp', regexpStr)
  } else {
    args.push('--fixed-strings')
    textPattern = pattern
  }

  if (regexpStr && isMultilineRegexp(regexpStr)) {
    args.push('--multiline')
  }

  args.push(options.isCaseSensitive ? '--case-sensitive' : '--ignore-case')
  if (options.isWholeWord) args.push('--word-regexp')
  if (options.followSymlinks) args.push('--follow')
  if (options.maxFileSize) args.push('--max-filesize', String(options.maxFileSize))
  if (options.includeHidden) args.push('--hidden')
  if (options.noIgnore) args.push('--no-ignore')

  for (const inclusion of prepareGlobs(options.inclusions || [], directoryPath)) {
    args.push('--iglob', inclusion)
  }
  for (const exclusion of prepareGlobs(options.exclusions || [], directoryPath)) {
    args.push('--iglob', '!' + exclusion)
  }

  args.push('--')
  if (textPattern) {
    args.push(textPattern)
  }
  args.push(directoryPath)

  return new Promise((resolve, reject) => {
    let buffer = ''
    let bufferError = ''
    let pendingEvent
    let pendingLeadingContext
    let pendingTrailingContexts
    let searchedFiles = 0
    const results = []
    let truncated = false

    const child = spawn(getRipgrepPath(), args, {
      cwd: directoryPath,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    child.on('close', code => {
      if (code !== null && code > 1) {
        reject(new Error(bufferError))
      } else {
        resolve({ results, truncated })
      }
    })
    child.on('error', reject)

    child.stderr.on('data', chunk => {
      bufferError += chunk
    })

    child.stdout.on('data', chunk => {
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        const message = JSON.parse(line)
        if (message.type === 'begin') {
          pendingEvent = {
            filePath: getText(message.data.path),
            matches: []
          }
          pendingLeadingContext = []
          pendingTrailingContexts = new Set()
        } else if (message.type === 'match') {
          const trailingContextLines = []
          pendingTrailingContexts.add(trailingContextLines)
          processUnicodeMatch(message.data)
          for (const submatch of message.data.submatches) {
            const { lineText, range } = processSubmatch(
              submatch,
              getText(message.data.lines),
              message.data.line_number - 1
            )

            pendingEvent.matches.push({
              matchText: getText(submatch.match),
              lineText,
              range,
              leadingContextLines: [...pendingLeadingContext],
              trailingContextLines
            })
          }
        } else if (message.type === 'end') {
          searchedFiles++
          results.push(pendingEvent)
          if (searchedFiles > 100) {
            truncated = true
            child.kill()
            return
          }
          pendingEvent = null
        }
      }
    })
  })
}
