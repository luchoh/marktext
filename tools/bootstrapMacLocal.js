'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
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

const electronPackage = require(path.join(rootDir, 'node_modules', 'electron', 'package.json'))

const ensureDir = dir => {
  fs.mkdirSync(dir, { recursive: true })
}

const getElectronCacheRoot = () => {
  return process.env.MARKTEXT_ELECTRON_CACHE ||
    process.env.electron_config_cache ||
    path.join(os.homedir(), 'Library', 'Caches', 'electron')
}

const seedElectronCache = cacheRoot => {
  const electronZip = process.env.MARKTEXT_ELECTRON_ZIP
  if (!electronZip) return

  if (!fs.existsSync(electronZip)) {
    fail(`MARKTEXT_ELECTRON_ZIP points to a missing file: ${electronZip}`)
  }

  const version = electronPackage.version
  const platform = process.platform
  const arch = process.arch
  const filename = `electron-v${version}-${platform}-${arch}.zip`

  const downloadBaseUrl = `https://github.com/electron/electron/releases/download/v${version}`
  const cacheKey = crypto
    .createHash('sha256')
    .update(downloadBaseUrl)
    .digest('hex')

  const hashedDir = path.join(cacheRoot, cacheKey)
  ensureDir(hashedDir)
  ensureDir(cacheRoot)

  const hashedTarget = path.join(hashedDir, filename)
  const topLevelTarget = path.join(cacheRoot, filename)

  for (const target of [hashedTarget, topLevelTarget]) {
    if (fs.existsSync(target)) continue
    fs.copyFileSync(electronZip, target)
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
const electronCacheRoot = getElectronCacheRoot()
seedElectronCache(electronCacheRoot)
const env = {
  ...process.env,
  npm_config_python: python,
  PYTHON: python,
  electron_config_cache: electronCacheRoot
}

run('yarn', ['install', '--ignore-scripts', '--frozen-lockfile'], env)
run(process.execPath, ['tools/patchMacNativeModules.js'], env)
run(process.execPath, ['node_modules/electron/install.js'], env)
run(process.execPath, ['.electron-vue/postinstall.js'], env)
run('yarn', ['run', 'rebuild'], env)

console.log('\nLocal macOS bootstrap complete.')
console.log('Next steps: yarn run lint && yarn run security:check && yarn run validate-licenses && yarn run test')
