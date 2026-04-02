#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const RENDERER_ROOTS = [
  path.join(ROOT, 'src/renderer'),
  path.join(ROOT, 'src/muya')
]
const IGNORED_DIRECTORIES = new Set([
  path.join(ROOT, 'src/muya/lib/assets/libs')
])
const SECURITY_CONFIG_CHECKS = [
  {
    file: path.join(ROOT, 'src/main/config.js'),
    required: ['contextIsolation: true', 'nodeIntegration: false', 'webSecurity: true']
  },
  {
    file: path.join(ROOT, 'src/main/index.js'),
    forbidden: ['remoteInitialize']
  },
  {
    file: path.join(ROOT, 'src/main/windows/editor.js'),
    forbidden: ['remoteEnable(']
  },
  {
    file: path.join(ROOT, 'src/main/windows/setting.js'),
    forbidden: ['remoteEnable(']
  }
]
const FILE_EXTENSIONS = new Set(['.js', '.vue', '.ejs'])
const FORBIDDEN_RENDERER_PATTERNS = [
  {
    message: 'Renderer import from electron is forbidden. Use the preload bridge or renderer shim.',
    regex: /\bfrom\s+['"]electron['"]|\brequire\(\s*['"]electron['"]\s*\)/g
  },
  {
    message: '@electron/remote is forbidden.',
    regex: /@electron\/remote/g
  },
  {
    message: 'Renderer-side fs access is forbidden.',
    regex: /\bfrom\s+['"]fs(?:\/promises)?['"]|\brequire\(\s*['"]fs(?:\/promises)?['"]\s*\)/g
  },
  {
    message: 'Renderer-side child_process access is forbidden.',
    regex: /\bfrom\s+['"]child_process['"]|\brequire\(\s*['"]child_process['"]\s*\)/g
  },
  {
    message: 'window.require is forbidden in the renderer.',
    regex: /\bwindow\.require\b/g
  },
  {
    message: 'Renderer runtime process access is forbidden.',
    regex: /\bprocess\.(platform|versions|resourcesPath)\b/g
  },
  {
    message: 'Renderer runtime Buffer access is forbidden.',
    regex: /\bBuffer\b/g
  }
]

const failures = []

const walk = directory => {
  if (IGNORED_DIRECTORIES.has(directory)) {
    return []
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true })
  let output = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue
    }

    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      output = output.concat(walk(fullPath))
    } else if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      output.push(fullPath)
    }
  }
  return output
}

const reportMatch = (file, content, pattern, index) => {
  const prefix = content.slice(0, index)
  const line = prefix.split('\n').length
  failures.push(`${path.relative(ROOT, file)}:${line}: ${pattern.message}`)
}

for (const root of RENDERER_ROOTS) {
  for (const file of walk(root)) {
    const content = fs.readFileSync(file, 'utf8')

    for (const pattern of FORBIDDEN_RENDERER_PATTERNS) {
      pattern.regex.lastIndex = 0
      const match = pattern.regex.exec(content)
      if (match) {
        reportMatch(file, content, pattern, match.index)
      }
    }
  }
}

for (const check of SECURITY_CONFIG_CHECKS) {
  const content = fs.readFileSync(check.file, 'utf8')
  for (const required of check.required || []) {
    if (!content.includes(required)) {
      failures.push(`${path.relative(ROOT, check.file)}: missing required security setting: ${required}`)
    }
  }
  for (const forbidden of check.forbidden || []) {
    if (content.includes(forbidden)) {
      failures.push(`${path.relative(ROOT, check.file)}: forbidden pattern present: ${forbidden}`)
    }
  }
}

if (failures.length > 0) {
  console.error('Security checks failed:\n')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Security checks passed.')
