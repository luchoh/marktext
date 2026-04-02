#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${MARKTEXT_REMOTE:-origin}"
DEPLOY_CHANNEL="${MARKTEXT_DEPLOY_CHANNEL:-tag}"
SOURCE_REF="${MARKTEXT_SOURCE_REF:-${REMOTE}/develop}"
TARGET_REF="${MARKTEXT_TARGET_REF:-}"
INSTALL_DIR="${MARKTEXT_INSTALL_DIR:-$HOME/Applications}"
APP_NAME="${MARKTEXT_APP_NAME:-MarkText.app}"
INSTALL_APP="${INSTALL_DIR}/${APP_NAME}"
STATE_ROOT="${MARKTEXT_STATE_ROOT:-$HOME/Library/Application Support/MarkText Admin}"
STATE_FILE="${MARKTEXT_STATE_FILE:-${STATE_ROOT}/installed-release.env}"
METADATA_DIR="${MARKTEXT_METADATA_DIR:-${STATE_ROOT}/latest-build}"
FORCE_REBUILD="${MARKTEXT_FORCE_REBUILD:-0}"
SKIP_TESTS="${MARKTEXT_SKIP_TESTS:-0}"
KEEP_WORKTREE="${MARKTEXT_KEEP_WORKTREE:-0}"
ALLOW_DIRTY_CHECKOUT="${MARKTEXT_ALLOW_DIRTY_CHECKOUT:-0}"

log() {
  printf '[marktext-admin] %s\n' "$*"
}

fail() {
  printf '[marktext-admin] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

require_command git
require_command node
require_command yarn
require_command rsync

[[ "$(uname -s)" == "Darwin" ]] || fail 'This installer only supports macOS.'

cd "$ROOT_DIR"
git rev-parse --show-toplevel >/dev/null 2>&1 || fail 'Run this script from a MarkText git checkout.'
git remote get-url "$REMOTE" >/dev/null 2>&1 || fail "Git remote '$REMOTE' does not exist."

if [[ "$ALLOW_DIRTY_CHECKOUT" != "1" ]] && [[ -n "$(git status --short)" ]]; then
  fail 'Deployment checkout must be clean. Commit or stash local changes first.'
fi

log "Fetching updates from '$REMOTE'..."
git fetch --tags --prune "$REMOTE"

resolve_stable_tag() {
  git tag --sort=-version:refname --list 'v*' \
    | grep -E '^v[0-9]+(\.[0-9]+){1,2}$' \
    | head -n 1
}

resolve_target() {
  if [[ -n "$TARGET_REF" ]]; then
    RESOLVED_MODE='explicit'
    RESOLVED_REF="$TARGET_REF"
    RESOLVED_SHA="$(git rev-parse "${TARGET_REF}^{commit}" 2>/dev/null)" || fail "Unable to resolve MARKTEXT_TARGET_REF=${TARGET_REF}"
    return
  fi

  case "$DEPLOY_CHANNEL" in
    branch)
      RESOLVED_MODE='branch'
      RESOLVED_REF="$SOURCE_REF"
      RESOLVED_SHA="$(git rev-parse "${SOURCE_REF}^{commit}" 2>/dev/null)" || fail "Unable to resolve branch ref '${SOURCE_REF}'"
      ;;
    tag)
      RESOLVED_MODE='tag'
      RESOLVED_REF="$(resolve_stable_tag)"
      [[ -n "$RESOLVED_REF" ]] || fail "No stable release tags found on remote '$REMOTE'."
      RESOLVED_SHA="$(git rev-parse "${RESOLVED_REF}^{commit}" 2>/dev/null)" || fail "Unable to resolve tag '${RESOLVED_REF}'"
      ;;
    *)
      fail "Unsupported MARKTEXT_DEPLOY_CHANNEL='${DEPLOY_CHANNEL}'. Use 'tag' or 'branch'."
      ;;
  esac
}

resolve_target

if [[ -f "$STATE_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE"
fi

if [[ "$FORCE_REBUILD" != "1" ]] && [[ "${MARKTEXT_DEPLOY_SHA:-}" == "$RESOLVED_SHA" ]]; then
  log "Installed source already matches ${RESOLVED_REF} (${RESOLVED_SHA}). Skipping rebuild."
  exit 0
fi

mkdir -p "$STATE_ROOT"
mkdir -p "$INSTALL_DIR"
mkdir -p "$METADATA_DIR"

WORKTREE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/marktext-admin.XXXXXX")"

cleanup() {
  if [[ "$KEEP_WORKTREE" == "1" ]]; then
    log "Keeping worktree at $WORKTREE_DIR"
    return
  fi

  git worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
  rm -rf "$WORKTREE_DIR"
}

trap cleanup EXIT

log "Preparing detached worktree for ${RESOLVED_REF} (${RESOLVED_SHA})..."
git worktree add --detach "$WORKTREE_DIR" "$RESOLVED_SHA" >/dev/null

if ! (cd "$WORKTREE_DIR" && node -e "const scripts=(require('./package.json').scripts)||{}; process.exit(scripts['bootstrap:mac:local'] && scripts['release:mac:local:metadata'] ? 0 : 1)"); then
  fail "Target ref ${RESOLVED_REF} does not include the local macOS release flow. Use branch mode against ${REMOTE}/develop until the next tagged release includes it."
fi

run_in_worktree() {
  log "Running: $*"
  (cd "$WORKTREE_DIR" && "$@")
}

run_in_worktree yarn run bootstrap:mac:local
run_in_worktree yarn run lint
run_in_worktree yarn run security:check
run_in_worktree yarn run validate-licenses
if [[ "$SKIP_TESTS" == "1" ]]; then
  log 'Skipping tests because MARKTEXT_SKIP_TESTS=1.'
else
  run_in_worktree yarn run test
fi
run_in_worktree yarn run release:mac:local:metadata

BUILT_APP="$WORKTREE_DIR/build/mac-arm64/${APP_NAME}"
[[ -d "$BUILT_APP" ]] || fail "Expected built app bundle at ${BUILT_APP}"

log "Installing ${APP_NAME} into ${INSTALL_DIR}..."
mkdir -p "$INSTALL_APP"
rsync -a --delete "$BUILT_APP/" "$INSTALL_APP/"

for file in SHA256SUMS.txt release-metadata.json dependency-inventory.json sbom.cyclonedx.json provenance.json; do
  cp "$WORKTREE_DIR/build/$file" "$METADATA_DIR/$file"
done

INSTALLED_VERSION="$(
  /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INSTALL_APP/Contents/Info.plist" 2>/dev/null \
    || (cd "$WORKTREE_DIR" && node -p "require('./package.json').version")
)"

{
  printf 'MARKTEXT_DEPLOY_MODE=%q\n' "$RESOLVED_MODE"
  printf 'MARKTEXT_DEPLOY_REF=%q\n' "$RESOLVED_REF"
  printf 'MARKTEXT_DEPLOY_SHA=%q\n' "$RESOLVED_SHA"
  printf 'MARKTEXT_DEPLOY_VERSION=%q\n' "$INSTALLED_VERSION"
  printf 'MARKTEXT_INSTALL_DIR=%q\n' "$INSTALL_DIR"
  printf 'MARKTEXT_METADATA_DIR=%q\n' "$METADATA_DIR"
  printf 'MARKTEXT_DEPLOYED_AT=%q\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$STATE_FILE"

log "Installed MarkText ${INSTALLED_VERSION} from ${RESOLVED_REF}."
log "State file: ${STATE_FILE}"
log "Metadata: ${METADATA_DIR}"
