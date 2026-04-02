# Steps to release MarkText

## Preferred path: local macOS release

This repository treats a local macOS build as the primary trusted release path. GitHub Actions is useful as an external verification lane, but the authoritative build should come from a machine you control.

### Prepare the release candidate

1. Ensure [changelog](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md) is up-to-date.
2. Bump the version in `package.json` and the changelog.
3. Update `README.md` files as needed.
4. Create a release commit such as `release version %version%`.

### Build and validate locally on macOS

Run these commands from the repository root:

```bash
yarn run bootstrap:mac:local
yarn run lint
yarn run security:check
yarn run validate-licenses
yarn run test
yarn run release:mac:local:metadata
```

`bootstrap:mac:local` intentionally installs dependencies with scripts disabled first, patches `fontmanager-redux` for modern macOS toolchains, installs Electron explicitly, and only then rebuilds native modules. This avoids the current `fontmanager-redux` failure path on clean macOS hosts.

The local release build never publishes to GitHub because `release:mac:local` forces `--publish never`, clears `GH_TOKEN` / `GITHUB_TOKEN`, and uses a local-only electron-builder config that disables macOS code signing.

### Local output files

Packaged macOS release artifacts are written to `build/`:

- `build/marktext-arm64.dmg`
- `build/marktext-arm64-mac.zip`

Release-review metadata is also written to `build/`:

- `build/SHA256SUMS.txt`
- `build/release-metadata.json`
- `build/dependency-inventory.json`
- `build/sbom.cyclonedx.json`
- `build/provenance.json`

### Review before publishing

1. Inspect the generated `.dmg` and `.zip` artifacts in `build/`.
2. Review `build/SHA256SUMS.txt`.
3. Review `build/release-metadata.json`.
4. Review `build/dependency-inventory.json`.
5. Review `build/sbom.cyclonedx.json`.
6. Review `build/provenance.json`.

### Publish

1. Create or update the GitHub release manually.
2. Add git tag `v%version%`.
3. Upload the reviewed `.dmg` and `.zip` files from `build/`.
4. Add changelog notes and checksums.

## Optional: GitHub Actions as verification

GitHub Actions can still be used to confirm that a clean external environment reproduces the build and test results.

- `Build` runs on pushes and pull requests for `main`, `master`, and `develop`.
- `Release` runs on pushes to `release-v*` branches.
- Workflow artifacts and GitHub attestations are secondary verification signals, not the primary trusted release artifact source in this model.

## Expected network downloads

- `yarn install` fetches the pinned dependency graph from the npm registry.
- `electron` downloads pinned runtime archives into the Electron cache when the cache is cold.
- `electron-builder` may download helper binaries into its cache on first package build.
- `playwright` may download browser binaries during dependency installation if its browser cache is absent.

## Flathub follow-up

Publish [Flathub package](https://github.com/flathub/com.github.marktext.marktext) separately:

- Ensure native dependencies
- Update `runtime` and `SDK` if needed
- Bump version and update URLs
- Test the package (`scripts/build-bundle.sh && scripts/test-marktext.sh`)
- Create commit `Update to v%version%`

## Work after releasing

- Ensure all issues in the changelog are closed
- :relaxed: :tada:
