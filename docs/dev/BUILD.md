# Build Instructions

Clone the repository:

```
git clone https://github.com/marktext/marktext.git
```

### Prerequisites

Before you can get started developing, you need set up your build environment:

- Node.js `16.19.1` and yarn (the repository pins this exact Node version in `.node-version`, and CI uses the same version)
- Python `3.11` is recommended for the current Node 16 / `node-gyp` toolchain. Newer Python releases may break native module builds because `distutils` was removed in Python 3.12+.
- C++ compiler and development tools
- Build is supported on Linux, macOS and Windows

**Additional development dependencies on Linux:**

- libX11 (with headers)
- libxkbfile (with headers)
- libsecret (with headers)
- libfontconfig (with headers)

On Debian-based Linux: `sudo apt-get install libx11-dev libxkbfile-dev libsecret-1-dev libfontconfig-dev`

On Red Hat-based Linux: `sudo dnf install libX11-devel libxkbfile-devel libsecret-devel fontconfig-devel`

**Additional development dependencies on Windows:**

- Windows 10 SDK (only needed before Windows 10)
- Visual Studio 2019 (preferred)

### Reproducible `devenv` and `direnv` setup

If you already have `nix`, `direnv`, and `devenv` installed, you can use the repo-local environment instead of managing Node.js and Yarn on the host:

1. Run `direnv allow`
2. Run `devenv shell`
3. Review the repository’s security posture before installing dependencies
4. Run `MARKTEXT_ALLOW_INSTALL=1 app-install` only if that review is acceptable
5. Run `devenv up app`

Useful commands from the shell:

- `app-lint`
- `app-unit`
- `app-build`

### Expected network activity

The project still requires some network access when caches are cold:

- `yarn install` fetches package tarballs from the npm registry.
- `electron` downloads pinned runtime archives into the Electron cache on first install/rebuild.
- `electron-builder` may download packaging helper binaries into its cache on first package build.
- `playwright` may download browser binaries during dependency installation if its local browser cache is absent.

CI and release workflows cache these downloads, pin the Node version via `.node-version`, and pin GitHub Actions by commit SHA to reduce drift.

### Let's build

1. Go to `marktext` folder
2. Install dependencies: `yarn install` or `yarn install --frozen-lockfile`
3. Build MarkText binaries and packages: `yarn run build`
4. MarkText binary is located under `build` folder

Copy the build app to applications folder, or if on Windows run the executable installer.

### Important scripts

```
$ yarn run <script> # or npm run <script>
```

| Script          | Description                                      |
| --------------- | ------------------------------------------------ |
| `build`         | Build MarkText binaries and packages for your OS |
| `build:bin`     | Build MarkText binary for your OS                |
| `dev`           | Build and run MarkText in developer mode         |
| `lint`          | Lint code style                                  |
| `test` / `unit` | Run unit tests                                   |

For more scripts please see `package.json`.
