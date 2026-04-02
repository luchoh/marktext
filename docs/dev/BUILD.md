# Build Instructions

Clone the repository:

```
git clone https://github.com/marktext/marktext.git
```

### Prerequisites

Before you can get started developing, you need set up your build environment:

- Node.js `>=v16` but `<v17` and yarn
- Python `>=v3.6` for node-gyp
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
