{ pkgs, inputs, ... }:

let
  node16Pkgs = inputs.nixpkgs-node16.legacyPackages.${pkgs.stdenv.system};
  node16 = node16Pkgs."nodejs-16_x";
  yarn16 = pkgs.writeShellScriptBin "yarn" ''
    exec ${node16}/bin/node ${node16Pkgs.yarn}/libexec/yarn/bin/yarn.js "$@"
  '';
  yarnpkg16 = pkgs.writeShellScriptBin "yarnpkg" ''
    exec ${node16}/bin/node ${node16Pkgs.yarn}/libexec/yarn/bin/yarn.js "$@"
  '';
in
{
  dotenv.enable = true;
  dotenv.filename = ".env.dev";

  packages = with pkgs; [
    git
    jq
    pkg-config
    python311
  ] ++ [
    yarn16
    yarnpkg16
    node16Pkgs.yarn
  ];

  languages.javascript = {
    enable = true;
    package = node16;
  };

  scripts = {
    "app-install".exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT"

      if [ "''${MARKTEXT_ALLOW_INSTALL:-0}" != "1" ]; then
        echo "Refusing to run yarn install automatically in this environment."
        echo "This repo runs lifecycle scripts, builds native modules, and fetches remote artifacts."
        echo "If you have reviewed and explicitly accept that risk, rerun:"
        echo "  MARKTEXT_ALLOW_INSTALL=1 app-install"
        exit 1
      fi

      export YARN_CACHE_FOLDER="$DEVENV_ROOT/.cache/yarn"
      export ELECTRON_CACHE="$DEVENV_ROOT/.cache/electron"
      export ELECTRON_BUILDER_CACHE="$DEVENV_ROOT/.cache/electron-builder"
      mkdir -p "$YARN_CACHE_FOLDER" "$ELECTRON_CACHE" "$ELECTRON_BUILDER_CACHE"

      yarn install --check-files --frozen-lockfile
    '';

    "app-lint".exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT"
      yarn run lint
    '';

    "app-unit".exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT"
      yarn run unit
    '';

    "app-build".exec = ''
      set -euo pipefail
      cd "$DEVENV_ROOT"
      yarn run build:bin
    '';
  };

  enterShell = ''
    export YARN_CACHE_FOLDER="$DEVENV_ROOT/.cache/yarn"
    export ELECTRON_CACHE="$DEVENV_ROOT/.cache/electron"
    export ELECTRON_BUILDER_CACHE="$DEVENV_ROOT/.cache/electron-builder"
    mkdir -p "$YARN_CACHE_FOLDER" "$ELECTRON_CACHE" "$ELECTRON_BUILDER_CACHE"

    if [ ! -f .env.dev ]; then
      cp .env.dev.example .env.dev
      echo "Created .env.dev from .env.dev.example"
    fi

    echo
    echo "MarkText devenv ready."
    echo "  MARKTEXT_ALLOW_INSTALL=1 app-install"
    echo "                   Install dependencies after explicit review"
    echo "  devenv up app    Run MarkText in dev mode"
    echo "  app-lint         Lint the codebase"
    echo "  app-unit         Run unit tests"
    echo "  app-build        Build the application"
  '';

  processes.app.exec = ''
    set -euo pipefail
    cd "$DEVENV_ROOT"

    export YARN_CACHE_FOLDER="$DEVENV_ROOT/.cache/yarn"
    export ELECTRON_CACHE="$DEVENV_ROOT/.cache/electron"
    export ELECTRON_BUILDER_CACHE="$DEVENV_ROOT/.cache/electron-builder"
    mkdir -p "$YARN_CACHE_FOLDER" "$ELECTRON_CACHE" "$ELECTRON_BUILDER_CACHE"

    if [ ! -f .env.dev ]; then
      echo "ERROR: .env.dev not found."
      echo "Run: cp .env.dev.example .env.dev"
      exit 1
    fi

    set -a
    . ./.env.dev
    set +a

    if [ ! -d node_modules ]; then
      echo "ERROR: node_modules is missing."
      echo "Automatic installs are disabled in this security-sensitive environment."
      echo "If you accept the risk, run:"
      echo "  MARKTEXT_ALLOW_INSTALL=1 app-install"
      exit 1
    fi

    exec yarn dev
  '';
}
