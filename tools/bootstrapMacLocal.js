'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const rootDir = path.resolve(__dirname, '..')

const fail = message => {
  console.error(`[ERROR] ${message}`)
  process.exit(1)
}

const run = (command, args, env) => {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: rootDir,
    env,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const detectPython = () => {
  const candidates = ['python3.11', 'python3', 'python']

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], {
      cwd: rootDir,
      encoding: 'utf8'
    })

    if (result.status !== 0) continue

    const versionOutput = `${result.stdout}${result.stderr}`.trim()
    const match = versionOutput.match(/Python\s+(\d+)\.(\d+)\.(\d+)/)
    if (!match) continue

    const major = Number(match[1])
    const minor = Number(match[2])
    if (major === 3 && minor < 12) {
      return candidate
    }
  }

  fail('Python 3.11 is recommended, and any Python 3 release older than 3.12 is required for Node 16 native module builds.')
}

if (process.platform !== 'darwin') {
  fail('bootstrap:mac:local only supports macOS.')
}

const pinnedNodeVersion = fs.readFileSync(path.join(rootDir, '.node-version'), 'utf8').trim()
if (process.version !== `v${pinnedNodeVersion}`) {
  fail(`Expected Node.js ${pinnedNodeVersion} from .node-version, but found ${process.version}.`)
}

const python = detectPython()
const env = {
  ...process.env,
  npm_config_python: python,
  PYTHON: python
}

run('yarn', ['install', '--ignore-scripts', '--frozen-lockfile'], env)
run(process.execPath, ['tools/patchMacNativeModules.js'], env)
run(process.execPath, ['node_modules/electron/install.js'], env)
run(process.execPath, ['.electron-vue/postinstall.js'], env)
run('yarn', ['run', 'rebuild'], env)

console.log('\nLocal macOS bootstrap complete.')
console.log('Next steps: yarn run lint && yarn run security:check && yarn run validate-licenses && yarn run test')
