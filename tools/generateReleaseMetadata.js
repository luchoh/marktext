'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const os = require('os')
const { execFileSync } = require('child_process')
const checker = require('license-checker')

const rootDir = path.resolve(__dirname, '..')
const outputDir = path.resolve(rootDir, process.argv[2] || 'build')
const generatedFiles = new Set([
  'SHA256SUMS.txt',
  'release-metadata.json',
  'dependency-inventory.json',
  'sbom.cyclonedx.json',
  'provenance.json'
])

const readJson = filename => {
  return JSON.parse(fs.readFileSync(path.join(rootDir, filename), 'utf8'))
}

const safeExec = (command, args) => {
  try {
    return execFileSync(command, args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch (error) {
    return null
  }
}

const toPosixPath = filepath => filepath.split(path.sep).join('/')

const getRelativePath = filepath => toPosixPath(path.relative(outputDir, filepath))

const listFiles = dir => {
  if (!fs.existsSync(dir)) return []

  const queue = [dir]
  const files = []
  while (queue.length) {
    const current = queue.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (!generatedFiles.has(entry.name)) {
        files.push(fullPath)
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b))
}

const hashFile = filepath => {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filepath))
  return hash.digest('hex')
}

const normalizeValue = value => {
  if (Array.isArray(value)) return value.join(', ')
  return value || null
}

const normalizeRepositoryUrl = repositoryUrl => {
  if (!repositoryUrl) return null
  if (/^git@github\.com:/.test(repositoryUrl)) {
    return repositoryUrl
      .replace(/^git@github\.com:/, 'https://github.com/')
      .replace(/\.git$/, '')
  }

  return repositoryUrl.replace(/^git\+/, '').replace(/\.git$/, '')
}

const parsePackageKey = key => {
  const lastAt = key.lastIndexOf('@')
  return {
    name: key.slice(0, lastAt),
    version: key.slice(lastAt + 1)
  }
}

const packageToPurl = ({ name, version }) => {
  const encodedName = encodeURIComponent(name).replace(/%2F/g, '/')
  return `pkg:npm/${encodedName}@${version}`
}

const collectDependencyInventory = () => {
  return new Promise((resolve, reject) => {
    checker.init({
      start: rootDir,
      production: true,
      development: false,
      excludePackages: 'file-icons@2.1.47',
      json: true
    }, (error, packages) => {
      if (error) {
        reject(error)
        return
      }

      const inventory = Object.keys(packages)
        .sort((a, b) => a.localeCompare(b))
        .map(key => {
          const { name, version } = parsePackageKey(key)
          const pkg = packages[key]
          return {
            name,
            version,
            licenses: normalizeValue(pkg.licenses),
            repository: normalizeValue(pkg.repository),
            publisher: normalizeValue(pkg.publisher),
            path: pkg.path ? toPosixPath(path.relative(rootDir, pkg.path)) : null,
            purl: packageToPurl({ name, version })
          }
        })

      resolve(inventory)
    })
  })
}

const toCycloneDxLicenses = licenses => {
  if (!licenses) return undefined

  return [{
    license: {
      name: licenses
    }
  }]
}

const generateSbom = ({ generatedAt, packageJson, repositoryUrl, dependencyInventory, gitSha }) => {
  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: generatedAt,
      component: {
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
        licenses: toCycloneDxLicenses(packageJson.license),
        purl: packageToPurl({
          name: packageJson.name,
          version: packageJson.version
        }),
        externalReferences: repositoryUrl
          ? [{
              type: 'vcs',
              url: repositoryUrl
            }]
          : undefined
      },
      properties: [
        {
          name: 'marktext:gitSha',
          value: gitSha
        }
      ]
    },
    components: dependencyInventory.map(pkg => ({
      type: 'library',
      name: pkg.name,
      version: pkg.version,
      purl: pkg.purl,
      licenses: toCycloneDxLicenses(pkg.licenses),
      publisher: pkg.publisher || undefined,
      externalReferences: pkg.repository
        ? [{
            type: 'vcs',
            url: normalizeRepositoryUrl(pkg.repository)
          }]
        : undefined,
      properties: [
        {
          name: 'marktext:path',
          value: pkg.path || ''
        }
      ].filter(property => property.value)
    }))
  }
}

const generateProvenance = ({ generatedAt, packageJson, repositoryUrl, gitSha, gitRef, workflow, toolchain, artifacts, dependencyInventoryPath, sbomPath }) => {
  return {
    formatVersion: 1,
    generatedAt,
    predicateType: 'https://marktext.app/security/release-provenance/v1',
    subject: artifacts.map(artifact => ({
      name: artifact.path,
      digest: {
        sha256: artifact.sha256
      }
    })),
    builder: {
      id: workflow.runId && process.env.GITHUB_REPOSITORY
        ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${workflow.runId}`
        : 'local'
    },
    buildDefinition: {
      buildType: 'marktext-release',
      externalParameters: {
        repository: repositoryUrl,
        gitRef,
        gitSha
      },
      internalParameters: {
        workflow,
        toolchain,
        platform: {
          os: process.platform,
          arch: process.arch,
          hostname: os.hostname()
        }
      }
    },
    resolvedDependencies: [
      {
        uri: repositoryUrl ? `git+${repositoryUrl}@${gitSha}` : null,
        digest: {
          gitSha
        }
      },
      {
        uri: dependencyInventoryPath,
        digest: {
          sha256: hashFile(path.join(outputDir, dependencyInventoryPath))
        }
      },
      {
        uri: sbomPath,
        digest: {
          sha256: hashFile(path.join(outputDir, sbomPath))
        }
      }
    ].filter(entry => entry.uri),
    materials: [
      {
        uri: packageToPurl({
          name: packageJson.name,
          version: packageJson.version
        }),
        digest: {
          gitSha
        }
      }
    ]
  }
}

const getYarnVersion = () => {
  const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn'
  return safeExec(yarnCommand, ['--version'])
}

const main = async () => {
  const packageJson = readJson('package.json')
  const nodeVersionFile = path.join(rootDir, '.node-version')
  const pinnedNodeVersion = fs.existsSync(nodeVersionFile)
    ? fs.readFileSync(nodeVersionFile, 'utf8').trim()
    : null
  const generatedAt = new Date().toISOString()
  const gitSha = process.env.GITHUB_SHA || safeExec('git', ['rev-parse', 'HEAD'])
  const gitRef = process.env.GITHUB_REF || safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
  const repositoryUrl = normalizeRepositoryUrl(packageJson.repository && packageJson.repository.url)

  fs.mkdirSync(outputDir, { recursive: true })

  const artifactFiles = listFiles(outputDir)
  const artifacts = artifactFiles.map(filepath => {
    const stat = fs.statSync(filepath)
    return {
      path: getRelativePath(filepath),
      size: stat.size,
      sha256: hashFile(filepath)
    }
  })

  const checksumsPath = path.join(outputDir, 'SHA256SUMS.txt')
  const checksums = artifacts
    .map(({ path: relativePath, sha256 }) => `${sha256}  ${relativePath}`)
    .join('\n')
  fs.writeFileSync(checksumsPath, checksums ? `${checksums}\n` : '', 'utf8')

  const dependencyInventory = await collectDependencyInventory()
  const dependencyInventoryPath = path.join(outputDir, 'dependency-inventory.json')
  fs.writeFileSync(dependencyInventoryPath, JSON.stringify({
    formatVersion: 1,
    generatedAt,
    packageManager: 'yarn',
    packageCount: dependencyInventory.length,
    packages: dependencyInventory
  }, null, 2), 'utf8')

  const sbom = generateSbom({
    generatedAt,
    packageJson,
    repositoryUrl,
    dependencyInventory,
    gitSha
  })
  const sbomPath = path.join(outputDir, 'sbom.cyclonedx.json')
  fs.writeFileSync(sbomPath, JSON.stringify(sbom, null, 2), 'utf8')

  const workflow = {
    runId: process.env.GITHUB_RUN_ID || null,
    runNumber: process.env.GITHUB_RUN_NUMBER || null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    job: process.env.GITHUB_JOB || null,
    actor: process.env.GITHUB_ACTOR || null
  }
  const toolchain = {
    node: process.version,
    pinnedNode: pinnedNodeVersion,
    yarn: getYarnVersion(),
    electron: packageJson.devDependencies.electron || packageJson.dependencies.electron || null
  }

  const releaseMetadata = {
    formatVersion: 1,
    generatedAt,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      license: packageJson.license
    },
    source: {
      gitSha,
      gitRef,
      repository: process.env.GITHUB_REPOSITORY || repositoryUrl
    },
    workflow,
    toolchain,
    artifacts,
    dependencyInventory: {
      path: 'dependency-inventory.json',
      packageCount: dependencyInventory.length
    },
    sbom: {
      path: 'sbom.cyclonedx.json',
      format: 'CycloneDX',
      specVersion: '1.5'
    },
    provenance: {
      path: 'provenance.json',
      signed: false
    },
    checksums: {
      path: 'SHA256SUMS.txt',
      algorithm: 'sha256'
    }
  }

  const provenance = generateProvenance({
    generatedAt,
    packageJson,
    repositoryUrl,
    gitSha,
    gitRef,
    workflow,
    toolchain,
    artifacts,
    dependencyInventoryPath: 'dependency-inventory.json',
    sbomPath: 'sbom.cyclonedx.json'
  })
  const provenancePath = path.join(outputDir, 'provenance.json')
  fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2), 'utf8')

  const metadataPath = path.join(outputDir, 'release-metadata.json')
  fs.writeFileSync(metadataPath, JSON.stringify(releaseMetadata, null, 2), 'utf8')

  process.stdout.write([
    `Generated ${path.relative(rootDir, checksumsPath)}`,
    `Generated ${path.relative(rootDir, dependencyInventoryPath)}`,
    `Generated ${path.relative(rootDir, sbomPath)}`,
    `Generated ${path.relative(rootDir, provenancePath)}`,
    `Generated ${path.relative(rootDir, metadataPath)}`
  ].join('\n') + '\n')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
