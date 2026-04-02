# MarkText Security Review

Reviewed repository: `../marktext` at commit `be81e3aa57ed9ab9401cdaebeffacb056cd9272b` on branch `develop`

## Executive Summary

I would not adopt this repo as-is for a tightly controlled security perimeter.

The main problem is not telemetry or hidden proxying. I did not find either of those in the application code. The main problem is that MarkText runs its renderer with unusually weak Electron isolation settings while also processing untrusted markdown, pasted HTML, and HTML preview content. That would already be a serious architectural risk, and it is made materially worse by the repo pinning `dompurify` `2.3.6`, which is now affected by post-2024 DOMPurify advisories.

Separately, the packaged app does have a self-update capability, but it is not unattended: the user must explicitly trigger `Check for updates...` and then approve the download. There is also no obvious analytics stack. Privacy posture is decent; runtime hardening posture is not.

## Findings

### Critical

#### MT-SEC-001: Renderer compromise is effectively full local compromise

Impact: any sanitizer bypass or renderer XSS can cross directly into Node/Electron APIs and local OS access.

Evidence:

- [`../marktext/src/main/config.js:5`](../marktext/src/main/config.js:5) sets editor windows with:
  - `contextIsolation: false` at line 9
  - `nodeIntegration: true` at line 14
  - `webSecurity: false` at line 15
- [`../marktext/src/main/config.js:24`](../marktext/src/main/config.js:24) sets the preferences window with the same pattern at lines 29 to 34.
- [`../marktext/src/main/index.js:79`](../marktext/src/main/index.js:79) initializes `@electron/remote` globally.
- [`../marktext/src/main/windows/editor.js:79`](../marktext/src/main/windows/editor.js:79) enables the remote bridge for editor windows.
- [`../marktext/src/main/windows/setting.js:46`](../marktext/src/main/windows/setting.js:46) enables the remote bridge for settings windows.

Why this matters:

- `nodeIntegration: true` means renderer JavaScript can access Node primitives.
- `contextIsolation: false` removes a major boundary between app code and rendered content.
- `webSecurity: false` weakens browser-origin protections.
- `@electron/remote` expands the blast radius of renderer compromise by exposing privileged main-process functionality back into the renderer.

This would be risky in any Electron app. In a markdown editor that explicitly accepts pasted HTML and HTML preview blocks, it is much worse because the application continuously handles attacker-shaped markup.

Related sinks:

- [`../marktext/src/muya/lib/parser/render/renderBlock/renderLeafBlock.js:134`](../marktext/src/muya/lib/parser/render/renderBlock/renderLeafBlock.js:134) sanitizes and re-renders HTML preview blocks.
- [`../marktext/src/muya/lib/contentState/pasteCtrl.js:76`](../marktext/src/muya/lib/contentState/pasteCtrl.js:76) sanitizes pasted HTML before inserting it.

### High

#### MT-SEC-002: The app relies on a DOMPurify version that is now in known-vulnerable ranges

Impact: published DOMPurify bypasses become much more dangerous here because MT-SEC-001 turns renderer XSS into local compromise.

Evidence:

- [`../marktext/package.json:49`](../marktext/package.json:49) declares `dompurify` `^2.3.6`.
- [`../marktext/yarn.lock:5280`](../marktext/yarn.lock:5280) pins `dompurify` to `2.3.6`.
- [`../marktext/src/renderer/util/dompurify.js:3`](../marktext/src/renderer/util/dompurify.js:3) enables HTML and SVG sanitization profiles and uses DOMPurify as a central sanitizer.
- [`../marktext/src/muya/lib/parser/render/renderBlock/renderLeafBlock.js:135`](../marktext/src/muya/lib/parser/render/renderBlock/renderLeafBlock.js:135) uses that sanitizer for HTML preview blocks.
- [`../marktext/src/muya/lib/contentState/pasteCtrl.js:77`](../marktext/src/muya/lib/contentState/pasteCtrl.js:77) uses that sanitizer for pasted HTML.

Current external security context:

- GitHub advisory GHSA-gx9m-whjm-85jf marks DOMPurify versions `<2.5.0` as affected by a critical nesting-based mXSS issue.
- GitHub advisory GHSA-mmhx-hmjr-r674 marks DOMPurify versions `<2.5.4` as affected by a high-severity prototype-pollution issue.

Because MarkText is pinned to `2.3.6`, it falls into both affected ranges.

### High

#### MT-SEC-003: The shipped runtime base is stale enough that official binaries should be treated as security-debt, not a maintained desktop runtime

Impact: even if the app code were perfect, adopting the official release means inheriting an old Electron/Chromium base and an EOL frontend framework.

Evidence:

- [`../marktext/package.json:118`](../marktext/package.json:118) declares `electron` `^18.0.4`.
- [`../marktext/yarn.lock:5509`](../marktext/yarn.lock:5509) pins `electron` to `18.0.4`.
- [`../marktext/package.json:85`](../marktext/package.json:85) declares `vue` `^2.6.14`.
- [`../marktext/yarn.lock:13227`](../marktext/yarn.lock:13227) pins `vue` to `2.6.14`.

Current external security context:

- Electron’s official support policy says only the latest three stable major versions are supported. By inference, Electron `18` is long out of support today.
- The official Vue blog announced Vue 2 reached EOL on December 31, 2023.
- The MarkText releases page still shows `0.17.1` as the latest release, dated March 7, 2022.

This is not a proof of a specific exploitable bug by itself. It is a maintenance and patch-latency problem: the official release channel appears substantially behind current Electron security support.

### Medium

#### MT-SEC-004: Packaged builds have a remote self-update path, but it is manual rather than unattended

Impact: not a silent updater, but packaged AppImage/Windows-installer builds can fetch and install new code from GitHub Releases once a user initiates the flow.

Evidence:

- [`../marktext/src/main/menu/actions/marktext.js:9`](../marktext/src/main/menu/actions/marktext.js:9) sets `autoUpdater.autoDownload = false`.
- [`../marktext/src/main/menu/actions/marktext.js:41`](../marktext/src/main/menu/actions/marktext.js:41) only downloads after the user answers the prompt.
- [`../marktext/src/main/menu/actions/marktext.js:31`](../marktext/src/main/menu/actions/marktext.js:31) immediately calls `quitAndInstall()` after download.
- [`../marktext/src/main/menu/templates/help.js:98`](../marktext/src/main/menu/templates/help.js:98) only exposes the update entry when the package is considered updatable at runtime.
- The upstream releases page publishes `latest.yml`, `latest-mac.yml`, and `latest-linux.yml`, which are standard electron-updater metadata assets.

Conclusion:

- I did not find an unattended runtime updater.
- I did find a user-triggered self-update mechanism for some packaged targets.
- Once the user approves the update, the app installs it immediately after download and even carries a TODO acknowledging the lack of a final save prompt.

### Low

#### MT-SEC-005: Ctrl/Cmd-click on local links can open arbitrary local non-markdown files

Impact: if a user opens an untrusted note and intentionally clicks a crafted local link, MarkText will hand that path to the OS.

Evidence:

- [`../marktext/src/main/menu/actions/file.js:416`](../marktext/src/main/menu/actions/file.js:416) handles link clicks.
- [`../marktext/src/main/menu/actions/file.js:422`](../marktext/src/main/menu/actions/file.js:422) allows only `http/https` for external URLs and blocks other schemes.
- [`../marktext/src/main/menu/actions/file.js:442`](../marktext/src/main/menu/actions/file.js:442) resolves absolute or relative local paths.
- [`../marktext/src/main/menu/actions/file.js:448`](../marktext/src/main/menu/actions/file.js:448) calls `shell.openPath(pathname)` for non-markdown local targets.

This is user-assisted behavior, not background execution. I am calling it out because it matters if you expect users to inspect untrusted markdown from external sources.

## Direct Answers

### 1. Any proxies?

I did not find application-level proxy configuration or proxy routing logic.

What I checked:

- Grepped for `setProxy`, `proxyRules`, `http_proxy`, `https_proxy`, `pac`, `socks`, `tunnel`, and related terms.
- No runtime calls configuring Electron sessions or custom proxy agents were found in app code.

Important nuance:

- The dependency tree contains generic proxy-capable libraries in transitive build tooling, but I found no evidence that MarkText itself sets or operates an outbound proxy in runtime application code.

### 2. Any telemetry?

I did not find a general-purpose telemetry or analytics stack.

What I found instead:

- [`../marktext/src/main/exceptionHandler.js:113`](../marktext/src/main/exceptionHandler.js:113) starts Electron `crashReporter`, but with `uploadToServer: false`, so it stores crash data locally rather than sending it upstream.
- [`../marktext/src/muya/lib/ui/imageSelector/index.js:82`](../marktext/src/muya/lib/ui/imageSelector/index.js:82) and [`../marktext/src/muya/lib/ui/imageSelector/index.js:456`](../marktext/src/muya/lib/ui/imageSelector/index.js:456) call Unsplash APIs only if an Unsplash access key is baked into the build and the user uses the image picker.
- [`../marktext/src/renderer/util/fileSystem.js:110`](../marktext/src/renderer/util/fileSystem.js:110) supports user-configured GitHub/PicGo/custom-script image uploads, but defaults keep this off.

Default posture:

- [`../marktext/src/renderer/store/preferences.js:37`](../marktext/src/renderer/store/preferences.js:37) defaults image insertion to local-folder mode.
- [`../marktext/src/renderer/store/preferences.js:87`](../marktext/src/renderer/store/preferences.js:87) defaults `currentUploader` to `none`.
- [`../marktext/src/main/dataCenter/index.js:22`](../marktext/src/main/dataCenter/index.js:22) stores only `githubToken` in the OS keychain via `keytar`.

### 3. Any unattended upgrades that can pull contaminated code?

Runtime:

- No unattended runtime update flow was found.
- The self-updater is manual and only exposed on certain packaged targets.

Build and release pipeline:

- The repo is not hermetic or reproducible by design.
- [`../marktext/.github/workflows/release.yml:28`](../marktext/.github/workflows/release.yml:28) and [`../marktext/.github/workflows/build.yml:33`](../marktext/.github/workflows/build.yml:33) use `actions/setup-node` with `check-latest: true`.
- Both workflows fetch dependencies from the network via `yarn install --frozen-lockfile` and populate Electron/Electron-builder caches.

Counterpoint:

- The repo does make some effort to reduce prebuilt-binary drift:
  - [`../marktext/electron-builder.yml:9`](../marktext/electron-builder.yml:9) sets `buildDependenciesFromSource: true`.
  - [`../marktext/.electron-vue/postinstall.js:23`](../marktext/.electron-vue/postinstall.js:23) rewrites `keytar` install behavior on macOS to prefer source builds over `prebuild-install`.

So:

- No silent runtime updater.
- Yes, standard networked build/release supply-chain exposure exists.
- Official release artifacts are not built from a hermetic pipeline.

### 4. Overall security and privacy posture

Privacy:

- Better than average for a desktop app.
- No analytics SDK, no obvious telemetry beaconing, no crash uploads.
- Most outbound requests are feature-driven and user-triggered.

Security:

- Worse than I would accept for a high-trust desktop app.
- The renderer hardening model is weak enough that any future XSS or sanitizer bypass is likely to become a full local compromise.
- The dependency/runtime base is stale enough that I would not trust the official 2022 release line without substantial modernization.

## Recommendation

For strict environments:

- Do not adopt the upstream binary release as-is.
- Do not place this app inside a trusted workstation tier without sandboxing or strong OS-level containment.

If you still want MarkText-like functionality, the minimum acceptable path would be:

1. Rebase onto a current supported Electron line.
2. Remove `@electron/remote`.
3. Turn on `contextIsolation`.
4. Turn off `nodeIntegration`.
5. Turn `webSecurity` back on.
6. Upgrade DOMPurify immediately.
7. Re-review every HTML/clipboard/rendering flow after the above changes.

## External Sources

- Electron support policy: https://www.electronjs.org/docs/latest/tutorial/electron-timelines
- MarkText releases page: https://github.com/marktext/marktext/releases
- DOMPurify advisory GHSA-gx9m-whjm-85jf: https://github.com/cure53/DOMPurify/security/advisories/GHSA-gx9m-whjm-85jf
- DOMPurify advisory GHSA-mmhx-hmjr-r674: https://github.com/advisories/GHSA-mmhx-hmjr-r674
- Vue official EOL notice: https://blog.vuejs.org/
