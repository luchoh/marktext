'use strict'

const { spawnSync } = require('child_process')

const run = (command, args, env) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: false
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const env = {
  ...process.env,
  MARKTEXT_IS_STABLE: process.env.MARKTEXT_IS_STABLE || '1',
  GH_TOKEN: '',
  GITHUB_TOKEN: '',
  CSC_IDENTITY_AUTO_DISCOVERY: 'false'
}

if (process.env.MARKTEXT_ELECTRON_CACHE) {
  env.ELECTRON_CACHE = process.env.MARKTEXT_ELECTRON_CACHE
  env.electron_config_cache = process.env.MARKTEXT_ELECTRON_CACHE
}

if (process.env.MARKTEXT_ELECTRON_BUILDER_CACHE) {
  env.ELECTRON_BUILDER_CACHE = process.env.MARKTEXT_ELECTRON_BUILDER_CACHE
}

run(process.execPath, ['.electron-vue/build.js'], env)

const builderArgs = [
  'build',
  '--config',
  'electron-builder.mac-local.yml',
  '--publish',
  'never'
]

if (process.env.MARKTEXT_ELECTRON_DIST) {
  builderArgs.push(`-c.electronDist=${process.env.MARKTEXT_ELECTRON_DIST}`)
}

run('electron-builder', builderArgs, env)
