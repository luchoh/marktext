'use strict'

const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const fontManagerBindingGyp = path.join(rootDir, 'node_modules', 'fontmanager-redux', 'binding.gyp')
const nodeAddonApiPackageJson = path.join(rootDir, 'node_modules', 'node-addon-api', 'package.json')

const fail = message => {
  console.error(`[ERROR] ${message}`)
  process.exit(1)
}

if (!fs.existsSync(fontManagerBindingGyp)) {
  fail('Missing node_modules/fontmanager-redux/binding.gyp. Run the local bootstrap after dependencies are installed.')
}

if (!fs.existsSync(nodeAddonApiPackageJson)) {
  fail('Missing node_modules/node-addon-api/package.json. Run the local bootstrap after dependencies are installed.')
}

const nodeAddonApiVersion = JSON.parse(fs.readFileSync(nodeAddonApiPackageJson, 'utf8')).version
const nodeAddonApiMajor = Number((nodeAddonApiVersion.match(/^(\d+)\./) || [])[1])
if (!Number.isFinite(nodeAddonApiMajor) || nodeAddonApiMajor < 7) {
  fail(`node-addon-api ${nodeAddonApiVersion} is too old. Expected the Yarn resolution to install 7.x or newer.`)
}

const originalTarget = "'MACOSX_DEPLOYMENT_TARGET': '10.7'"
const patchedTarget = "'MACOSX_DEPLOYMENT_TARGET': '10.8'"
const bindingText = fs.readFileSync(fontManagerBindingGyp, 'utf8')

if (bindingText.includes(patchedTarget)) {
  console.log('[patchMacNativeModules] fontmanager-redux already targets macOS 10.8.')
  process.exit(0)
}

if (!bindingText.includes(originalTarget)) {
  fail('Unexpected fontmanager-redux binding.gyp contents. Refusing to patch automatically.')
}

fs.writeFileSync(fontManagerBindingGyp, bindingText.replace(originalTarget, patchedTarget), 'utf8')
console.log('[patchMacNativeModules] Patched fontmanager-redux to target macOS 10.8.')
