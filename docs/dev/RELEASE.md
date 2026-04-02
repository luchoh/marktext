# Steps to release MarkText

- Create a release candidate
  - Create branch `release-v%version%`
  - Set environment variable `MARKTEXT_IS_STABLE` to `1` (default on AppVeyor and Travis CI)
  - Ensure [changelog](https://github.com/marktext/marktext/blob/master/.github/CHANGELOG.md) is up-to-date
  - Bump version in `package.json` and changelog
  - Update all `README.md` files
  - Bump Flathub version ([marktext.appdata.xml](https://github.com/marktext/marktext/blob/master/resources/linux/marktext.appdata.xml))
  - Create commit `release version %version%`
  - Ensure all tests pass
  - A new draft release should be available or create one
- Publish GitHub release
  - Add git tag `v%version%`
  - Add changelog
  - Add SHA256 checksums
  - Review generated `build/SHA256SUMS.txt`
  - Review generated `build/release-metadata.json`
  - Review generated `build/dependency-inventory.json`
  - Review generated `build/sbom.cyclonedx.json`
  - Review generated `build/provenance.json`
- Review workflow artifacts
  - Download the `release-metadata-*` workflow artifacts
  - Confirm checksums, toolchain versions, commit SHA, SBOM contents, and dependency inventory match the intended release inputs
  - Confirm `build/provenance.json` subjects and workflow identifiers match the published release artifacts
- Review expected network downloads
  - `yarn install` should only fetch the pinned dependency graph from the registry
  - Electron runtime downloads should land in the Electron cache
  - `electron-builder` helper downloads should land in the electron-builder cache
  - Playwright browser downloads are expected only when the browser cache is cold
- Update website and documentation
- Publish [Flathub package](https://github.com/flathub/com.github.marktext.marktext)
  - Ensure native dependencies
  - Update `runtime` and `SDK` if needed
  - Bump version and update URLs
  - Test the package (`scripts/build-bundle.sh && scripts/test-marktext.sh`)
  - Create commit `Update to v%version%`

## Work after releasing

- Ensure all issues in the changelog are closed
- :relaxed: :tada:
