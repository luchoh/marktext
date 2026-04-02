# Security Hardening PRD

## Status

- Owner: MarkText maintainers
- Type: Engineering PRD
- Scope: Desktop runtime, renderer isolation, content sanitization, updater flow, release pipeline, and link-handling safety
- Source of truth for problem statement: [`../../marktext-security-review.md`](../../marktext-security-review.md)

## Summary

MarkText should not ship another broadly recommended desktop release until the application no longer treats renderer compromise as equivalent to local machine compromise.

This PRD converts the findings from `marktext-security-review.md` into an implementation plan with concrete release gates. The primary goal is to make untrusted markdown, pasted HTML, and preview content safe to render inside the app without granting that content direct access to Node.js, Electron internals, or privileged main-process functionality.

## Findings Addressed

| Review ID | Problem | PRD response |
| --- | --- | --- |
| `MT-SEC-001` | Renderer compromise is effectively full local compromise due to `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`, and `@electron/remote`. | Epics 1 and 2 remove direct renderer privileges and move all privileged access behind a preload bridge. |
| `MT-SEC-002` | `dompurify` `2.3.6` is in vulnerable ranges and is used on untrusted content paths. | Epic 3 upgrades and revalidates sanitization with narrower allowlists and regression payload coverage. |
| `MT-SEC-003` | Electron `18` and Vue `2` are stale/EOL enough that the shipped runtime should be treated as security debt. | Epic 4 establishes supported runtime targets, framework migration, and release support policy. |
| `MT-SEC-004` | Manual updater exists, but installs immediately after download without a final save prompt. | Epic 5 changes the updater flow to a staged install model with explicit user confirmation and admin-disable support. |
| `MT-SEC-005` | Ctrl/Cmd-click on local links can open arbitrary local non-markdown files. | Epic 6 adds safer local-link policy, interstitial UX, and enterprise controls. |
| Supply chain note | CI and release are networked and not hardened enough for high-trust environments. | Epic 7 hardens workflows, version pinning, provenance, and release artifacts. |

## Product Goals

1. A malicious markdown file, pasted HTML payload, or sanitizer bypass must not gain direct access to Node.js or Electron main-process APIs.
2. MarkText must run on a supported Electron major and a maintained frontend stack.
3. Update installation must never terminate the app without an explicit final user decision and a save opportunity.
4. Opening local links from document content must be least-privilege and user-confirmed.
5. Release artifacts must be easier to trust: pinned inputs, reproducible-enough build metadata, signed outputs where supported, and documented provenance.
6. Privacy posture must not regress: no analytics SDK, no silent crash uploads, and no new background network behavior.

## Non-Goals

1. This PRD does not attempt to redesign editor UX unrelated to security.
2. This PRD does not require complete offline reproducibility on day one, but it does require materially stronger release hygiene.
3. This PRD does not require sandboxing arbitrary third-party markdown plugins because MarkText does not currently have a general plugin runtime.

## Security Invariants

The hardening work is complete only when all of the following are true:

1. Editor and settings renderers run with `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`, and no `@electron/remote`.
2. Renderer code does not import from `electron` or `@electron/remote` directly.
3. All privileged renderer operations go through a versioned preload bridge with an explicit allowlist.
4. DOMPurify is on a secure supported version and untrusted content flows have regression coverage.
5. No new release ships on an unsupported Electron major.
6. Local non-markdown paths are never opened from document content without a visible user choice.

## Current Implementation Hotspots

The following files define most of the migration scope:

- `src/main/config.js`
- `src/main/index.js`
- `src/main/windows/editor.js`
- `src/main/windows/setting.js`
- `src/renderer/**/*` direct `electron` imports
- `src/renderer/node/**/*`
- `src/renderer/util/fileSystem.js`
- `src/renderer/util/pdf.js`
- `src/renderer/components/exportSettings/index.vue`
- `src/renderer/contextMenu/**/*` direct `@electron/remote` imports
- `src/renderer/util/dompurify.js`
- `src/muya/lib/parser/render/renderBlock/renderLeafBlock.js`
- `src/muya/lib/parser/render/index.js`
- `src/muya/lib/contentState/pasteCtrl.js`
- `src/muya/lib/utils/exportHtml.js`
- `src/main/menu/actions/marktext.js`
- `src/main/menu/actions/file.js`
- `package.json`
- `.github/workflows/build.yml`
- `.github/workflows/release.yml`

## Epics

### Epic 1: Renderer Privilege Boundary

Replace direct renderer access to Electron and Node.js with a preload API surface.

#### Requirements

1. Add dedicated preload entrypoints for editor and settings windows.
2. Expose a single namespaced bridge on `window`, for example `window.mt`.
3. Move every renderer capability currently imported from `electron`, `@electron/remote`, or Node builtins into that bridge or into explicit main-process services.
4. Eliminate direct renderer imports of:
   - `ipcRenderer`
   - `shell`
   - `clipboard`
   - `webFrame`
   - `@electron/remote`
   - Node core modules such as `fs`, `path`, `child_process`, and other runtime-only builtins used by shipped renderer code
5. Replace direct renderer reads of runtime Node globals such as `process`, `Buffer`, `__dirname`, `__filename`, and `process.resourcesPath` with preload-provided immutable app metadata or explicit IPC calls.
6. Audit transitive and vendored renderer dependencies for Node/runtime assumptions and replace or isolate any package that still requires Node in the renderer path.
7. Replace synchronous IPC such as `sendSync` with async `invoke` or event-driven APIs.
8. Introduce a central IPC contract registry so allowed channels are explicit and reviewable.

#### Concrete file work

1. Add new preload files under `src/main/preload/`.
2. Update `src/main/config.js` to define `preload`, `contextIsolation: true`, `nodeIntegration: false`, and `webSecurity: true`.
3. Remove `remoteInitializeServer()` from `src/main/index.js`.
4. Remove `remoteEnable(win.webContents)` from `src/main/windows/editor.js` and `src/main/windows/setting.js`.
5. Migrate renderer usages in `src/renderer/store/**/*`, `src/renderer/commands/**/*`, `src/renderer/components/**/*`, and `src/renderer/contextMenu/**/*` to `window.mt`.
6. Move renderer-side Node helpers in `src/renderer/node/**/*`, `src/renderer/util/fileSystem.js`, `src/renderer/util/pdf.js`, `src/renderer/components/exportSettings/index.vue`, and related path/version helpers to preload or main-process services.
7. Replace direct runtime platform/version/path discovery in renderer state with bridge-provided values.

#### Acceptance criteria

1. Static checks fail CI on any shipped renderer-side import or require of `electron`, `@electron/remote`, or Node core modules in `src/renderer` and renderer-executed `src/muya` code, except audited build-only code or test fixtures if explicitly allowed.
2. `window.require`, runtime `process`, `Buffer`, `__dirname`, and `__filename` are unavailable in renderer devtools; renderer-visible platform/app metadata is exposed only through preload or compile-time constants.
3. A renderer XSS cannot call Node.js APIs directly or recover Node access through transitive runtime dependencies.
4. Existing editor, settings, menu, clipboard, spellchecker, search/export, and file-management flows continue to work through the preload bridge or main-process services.

### Epic 2: Secure BrowserWindow Defaults and CSP

After the preload migration exists, flip the actual security switches and add defense-in-depth for app pages.

#### Requirements

1. Enable `contextIsolation: true` for editor and settings windows.
2. Disable `nodeIntegration`.
3. Enable `webSecurity`.
4. Remove any renderer dependency on `remote`.
5. Add a Content Security Policy for app windows that disallows remote script execution and limits resource origins to the minimum required set.
6. Audit any places where `webSecurity: false` was masking broken file/resource loading and replace them with explicit safe loading logic.

#### Acceptance criteria

1. BrowserWindow configs in `src/main/config.js` match the target defaults.
2. Manual QA verifies editor startup, settings, spellchecker, print/export, drag-drop, and image flows under those settings.
3. Automated smoke tests verify app pages boot with CSP enabled.

### Epic 3: Untrusted Content and Sanitizer Hardening

Reduce the attack surface of markdown/HTML rendering and upgrade the sanitizer stack.

#### Requirements

1. Upgrade `dompurify` to a secure maintained version and pin it in the lockfile.
2. Reassess the current profiles in `src/renderer/util/dompurify.js`.
3. Narrow untrusted HTML handling so user-authored HTML blocks and pasted HTML do not inherit permissive SVG/filter allowances unless proven necessary.
4. Treat markdown-driven renderer input as attacker-controlled all the way through preview and export. Mermaid, Flowchart, Sequence, PlantUML, Vega/Vega-Lite, and similar blocks are not trusted merely because MarkText invoked the renderer library.
5. Sanitize or otherwise isolate post-render HTML/SVG produced from markdown-driven diagram and rich-content renderers before insertion into the DOM or exported HTML.
6. Add regression tests for known DOMPurify bypass classes relevant to this app:
   - nesting-based mXSS
   - SVG-based payloads
   - attribute mutation payloads
   - prototype-pollution related sanitizer misuse
   - malicious diagram payloads routed through Mermaid, Flowchart, Sequence, PlantUML, and Vega/Vega-Lite code paths
7. Review and document every use of `innerHTML`, `DOMParser`, HTML-to-VNode conversion, and third-party renderer DOM insertion on untrusted content paths.

#### Concrete file work

1. Update `package.json` and lockfile.
2. Refactor `src/renderer/util/dompurify.js`.
3. Update sanitization and isolation call sites in:
   - `src/muya/lib/parser/render/renderBlock/renderLeafBlock.js`
   - `src/muya/lib/parser/render/index.js`
   - `src/muya/lib/contentState/pasteCtrl.js`
   - `src/muya/lib/utils/exportHtml.js`
4. Add security regression fixtures and tests under `test/`.

#### Acceptance criteria

1. Raw HTML blocks still render supported safe markup.
2. Known-bad payload corpus is neutralized across raw HTML, pasted HTML, preview rendering, and export rendering.
3. No markdown-driven diagram or rich-content renderer is classified as trusted solely because its output is app-generated.
4. No untrusted content path relies on permissive SVG/filter settings without a documented justification.

### Epic 4: Supported Runtime and Framework Baseline

Move the shipped app back onto maintained foundations.

#### Requirements

1. Upgrade Electron to a currently supported major at implementation time.
2. Upgrade the surrounding build/runtime toolchain required by that Electron jump.
3. Remove or replace deprecated Electron integration libraries that block the secure renderer model.
4. Replace Vue 2 and `vue-electron` with a maintained alternative.
5. Establish a release policy:
   - MarkText may only ship on an Electron major still inside official support.
   - MarkText may not ship on an EOL frontend framework.

#### Delivery strategy

1. Phase 4A: Electron and build stack modernization needed to support Epics 1 through 3 reliably.
2. Phase 4B: UI framework migration away from Vue 2 and `vue-electron`.

#### Acceptance criteria

1. `package.json` no longer pins Electron 18 or Vue 2.
2. Build, unit, and E2E pipelines pass on supported toolchains.
3. Release notes and docs declare the new supported baseline.

### Epic 5: Updater Hardening

Keep updates user-controlled and safe for unsaved work.

#### Requirements

1. Preserve manual update initiation by default.
2. Never call `quitAndInstall()` immediately on download completion.
3. Add a final confirmation dialog that includes:
   - target version
   - release notes link or summary
   - explicit reminder about unsaved documents
4. Stage the update for next restart unless the user explicitly chooses restart now.
5. Add a preference or managed-build option to disable self-update entirely.
6. Document platform-specific expectations around code signing and update verification.

#### Concrete file work

1. Update `src/main/menu/actions/marktext.js`.
2. Update renderer stores/UI that surface update state.
3. Update packaging and release docs if new signing requirements are introduced.

#### Acceptance criteria

1. Update download does not terminate the app without a final user decision.
2. Unsaved tabs remain saveable before installation.
3. Managed deployments can disable updater behavior.

### Epic 6: Local Link Opening Policy

Reduce the risk of opening arbitrary local files from untrusted markdown.

#### Requirements

1. Keep direct open-in-app behavior for markdown files.
2. For local non-markdown paths, replace direct `shell.openPath(pathname)` from document clicks with an interstitial.
3. The interstitial must show:
   - resolved absolute path
   - file type if known
   - actions such as `Reveal in Folder`, `Open Once`, and `Cancel`
4. Add a preference or managed policy to disable launching local non-markdown targets from document content entirely.
5. Block obviously dangerous executable/script targets by default unless the user explicitly confirms.

#### Concrete file work

1. Update `src/main/menu/actions/file.js`.
2. Add any renderer or main-process UI needed for the confirmation flow.

#### Acceptance criteria

1. Markdown links still open smoothly in-app.
2. Local non-markdown links no longer launch silently.
3. Dangerous local targets require an explicit confirmation step.

### Epic 7: Release and Supply-Chain Hardening

Make release artifacts materially more trustworthy.

#### Requirements

1. Remove `check-latest: true` from CI setup steps.
2. Pin GitHub Actions by commit SHA where feasible.
3. Keep Node/Electron versions explicit and stable across local dev, CI, and release.
4. Generate an SBOM for release artifacts.
5. Publish provenance/attestation metadata with releases.
6. Review dependency install behavior for unnecessary network downloads and document unavoidable cases.
7. Prefer source builds or verified/pinned binary fetches for native modules and Electron artifacts.

#### Concrete file work

1. Update `.github/workflows/build.yml`.
2. Update `.github/workflows/release.yml`.
3. Update release documentation under `docs/dev/`.

#### Acceptance criteria

1. CI inputs are pinned and reproducible enough to audit.
2. Release artifacts include traceable metadata.
3. Build pipeline no longer drifts to newer Node patchlines unexpectedly.

## Privacy Requirements

These constraints apply throughout all epics:

1. Do not add analytics or telemetry SDKs.
2. Keep crash uploads disabled by default.
3. Do not introduce new background network calls unrelated to explicit user actions.
4. If release hardening adds any network dependency, document it in release docs and threat-model it.

## Release Gates

### Gate A: Security Preview Release

Required before recommending a new build for general testing:

1. Epics 1, 2, 3, 5, and 6 complete.
2. Electron is on a supported major.
3. No renderer import of `electron` or `@electron/remote` remains.
4. Manual security regression suite passes.

### Gate B: Trusted Release Candidate

Required before recommending MarkText for stricter environments:

1. Gate A complete.
2. Epic 4 complete, including frontend stack modernization off Vue 2.
3. Epic 7 complete.
4. Release artifacts are signed and accompanied by provenance/SBOM metadata.

## Test Plan

### Automated

1. Static check: fail CI if renderer code imports from `electron` or `@electron/remote`.
2. Static check: fail CI if BrowserWindow options regress from secure defaults.
3. Sanitizer regression suite with stored payload corpus.
4. Integration tests for preload bridge methods and IPC allowlist enforcement.
5. E2E tests for:
   - open/save/export flows
   - updater confirmation flow
   - local link interstitial flow
   - spellchecker and clipboard paths after renderer isolation

### Manual

1. Open malicious markdown fixture files containing raw HTML, inline SVG, pasted HTML, and local file links.
2. Verify renderer devtools cannot access Node globals.
3. Verify settings window, titlebar interactions, context menus, and command palette after `remote` removal.
4. Verify unsaved work survives update download and install deferral.

## Risks

1. Renderer migration is large because current renderer code depends heavily on direct Electron APIs.
2. Electron and Vue migrations may require splitting the work across multiple release trains.
3. Enabling `webSecurity` may expose historical assumptions in file and asset loading.
4. Sanitizer tightening may initially break some HTML-heavy documents and needs compatibility review.

## Proposed Milestones

1. Milestone 1: Preload bridge skeleton, IPC registry, `remote` removal plan, renderer API inventory.
2. Milestone 2: Editor/settings windows run with secure BrowserWindow flags and no renderer-side Electron imports.
3. Milestone 3: DOMPurify upgrade, sanitizer regression suite, local-link confirmation flow.
4. Milestone 4: Safe updater flow and managed disable flag.
5. Milestone 5: Electron/runtime modernization to supported baseline.
6. Milestone 6: Vue 2 removal, release hardening, SBOM/provenance publication.

## Open Questions

1. Should enterprise or high-trust builds disable self-update entirely by default?
2. Is sandbox mode (`sandbox: true`) required for Gate A, or only for Gate B if preload migration reveals compatibility blockers?
3. Which HTML/SVG capabilities are truly required for raw HTML blocks versus trusted generated output?
4. Should local non-markdown links default to `Reveal in Folder` rather than `Open Once`?
