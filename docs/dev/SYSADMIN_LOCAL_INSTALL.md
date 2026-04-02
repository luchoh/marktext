# Sysadmin Manual: Local macOS Install And Update

This document is for a local, source-built MarkText deployment on macOS where the build machine is the trusted artifact source.

The workflow below does three things:

1. fetches `origin`
2. decides whether the deployed source changed
3. rebuilds and reinstalls only when it did

If the deployed source already matches the selected origin ref, the updater exits `0` and skips the rebuild.

## Trust Model

- Build on a Mac you control.
- Treat GitHub Actions as a verification lane, not the primary artifact source.
- Keep MarkText self-update disabled in managed installs. Do not set `MARKTEXT_ENABLE_SELF_UPDATE=1`.
- Use a dedicated deployment checkout, not your day-to-day development checkout.

## Requirements

- macOS on Apple Silicon
- Xcode Command Line Tools
- `git`
- Node `16.19.1`
- Yarn `1.x`
- Python `3.11` or another Python `3.x` older than `3.12`
- Enough free disk for a clean build and a temporary detached worktree

The repo already encodes the local bootstrap flow:

- [build bootstrap](../../tools/bootstrapMacLocal.js)
- [local macOS updater](../../tools/updateLocalMacInstall.sh)
- [local-only electron-builder config](../../electron-builder.mac-local.yml)

## Deployment Modes

The updater supports two modes:

- `tag` mode: default. Track the newest stable `vX.Y.Z` tag from `origin`.
- `branch` mode: track a branch ref such as `origin/develop` and compare by commit SHA.

Use `tag` mode for normal source releases.

Use `branch` mode only when the latest stable tag on `origin` predates the local-release tooling in this repo, or when you intentionally want a pre-release internal build.

The updater fails fast if the selected ref does not contain the local macOS release scripts. That is intentional.

## Recommended Layout

Use a dedicated checkout such as:

```bash
mkdir -p "$HOME/src"
git clone git@github.com:marktext/marktext.git "$HOME/src/marktext-admin"
cd "$HOME/src/marktext-admin"
```

For a per-user install, use:

```bash
export MARKTEXT_INSTALL_DIR="$HOME/Applications"
```

For a system-wide install, use:

```bash
export MARKTEXT_INSTALL_DIR="/Applications"
```

Only use `/Applications` if the invoking account can write there. Do not run the whole build as `root`.

## First Install

### Current safe path: branch mode

Use this until the next stable source release tag includes `bootstrap:mac:local` and `release:mac:local:metadata`:

```bash
cd "$HOME/src/marktext-admin"
MARKTEXT_DEPLOY_CHANNEL=branch \
MARKTEXT_SOURCE_REF=origin/develop \
MARKTEXT_INSTALL_DIR="${MARKTEXT_INSTALL_DIR:-$HOME/Applications}" \
tools/updateLocalMacInstall.sh
```

What this does:

- fetches `origin`
- creates a detached worktree at `origin/develop`
- bootstraps dependencies in controlled mode
- runs lint, security checks, license validation, and tests
- builds local arm64 release artifacts plus metadata
- installs `MarkText.app`
- writes deployment state and release metadata outside the app bundle

### Future stable-tag path

Once a stable release tag contains the local release flow, the normal command is:

```bash
cd "$HOME/src/marktext-admin"
MARKTEXT_INSTALL_DIR="${MARKTEXT_INSTALL_DIR:-$HOME/Applications}" \
tools/updateLocalMacInstall.sh
```

That tracks the newest stable `vX.Y.Z` tag on `origin`.

## Routine Update

Run the same command again.

If there is no new source to deploy, the updater prints a skip message like:

```text
[marktext-admin] Installed source already matches ...
```

and exits successfully without rebuilding.

## Where The Updater Stores State

By default the updater writes:

- install target: `~/Applications/MarkText.app`
- state file: `~/Library/Application Support/MarkText Admin/installed-release.env`
- release metadata: `~/Library/Application Support/MarkText Admin/latest-build/`

Override these with:

- `MARKTEXT_INSTALL_DIR`
- `MARKTEXT_STATE_ROOT`
- `MARKTEXT_STATE_FILE`
- `MARKTEXT_METADATA_DIR`

## Validation And Metadata

The updater runs these checks by default:

- `yarn run bootstrap:mac:local`
- `yarn run lint`
- `yarn run security:check`
- `yarn run validate-licenses`
- `yarn run test`
- `yarn run release:mac:local:metadata`

The installed metadata directory includes:

- `SHA256SUMS.txt`
- `release-metadata.json`
- `dependency-inventory.json`
- `sbom.cyclonedx.json`
- `provenance.json`

## Fast Paths And Overrides

Force a rebuild even when the deployed source matches:

```bash
MARKTEXT_FORCE_REBUILD=1 tools/updateLocalMacInstall.sh
```

Skip tests only if you explicitly accept lower assurance:

```bash
MARKTEXT_SKIP_TESTS=1 tools/updateLocalMacInstall.sh
```

Deploy an exact ref or tag:

```bash
MARKTEXT_TARGET_REF=<git-ref-or-tag> tools/updateLocalMacInstall.sh
```

Keep the detached worktree for debugging:

```bash
MARKTEXT_KEEP_WORKTREE=1 tools/updateLocalMacInstall.sh
```

## Verify The Installed App

Check the installed version:

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' \
  "${MARKTEXT_INSTALL_DIR:-$HOME/Applications}/MarkText.app/Contents/Info.plist"
```

Inspect the recorded deployment state:

```bash
cat "${MARKTEXT_STATE_FILE:-$HOME/Library/Application Support/MarkText Admin/installed-release.env}"
```

## Rollback

To redeploy an older known-good ref:

```bash
cd "$HOME/src/marktext-admin"
MARKTEXT_TARGET_REF=<known-good-ref> \
MARKTEXT_FORCE_REBUILD=1 \
MARKTEXT_INSTALL_DIR="${MARKTEXT_INSTALL_DIR:-$HOME/Applications}" \
tools/updateLocalMacInstall.sh
```

Only do this for refs that contain the local macOS release flow. If the target ref predates that tooling, the updater will stop and tell you to use a newer ref or branch mode.
