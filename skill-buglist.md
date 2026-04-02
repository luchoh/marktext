# Setup Environment Skill Bug List

## Confirmed problems

1. The skill never mentions `devenv.yaml`, but `devenv 1.11.2` scaffolds and expects it as part of a normal setup.
2. The skill says a missing `.envrc` should be a two-line file, but current `devenv init` scaffolds a richer `.envrc` with `DIRENV_WARN_TIMEOUT` and inline guidance.
3. The skill never says to update `.gitignore` for `.direnv`, `.devenv*`, and local `devenv.local.*` overrides, even though `devenv init` does.
4. The JS/TS reference hardcodes `nodejs_22`, which is wrong for repos like MarkText that are pinned to Node 16 in both docs and CI.
5. The skill assumes `.env.dev` and `.env.test` should always exist, but some repos do not need environment profiles at all. That guidance should be conditional instead of mandatory.
6. The skill implicitly steers new setups toward the default rolling nixpkgs input, but that broke immediately for this repo because rolling no longer provides `pkgs.nodejs_16`.
7. The skill’s generic `python3` guidance is not enough for older Node/Electron repos. This repo’s native-module install path hit `node-gyp` failures on Python `3.13` because `distutils` is gone there, so the skill should mention pinning an older compatible Python when old `node-gyp` stacks are in play.
8. The validation checklist says to run `devenv up <service>`, but in non-TTY automation the default `process-compose` TUI can fail with `/dev/tty` errors or hide the actual service output. The skill should mention validating `devenv up` from a PTY or using a non-TUI alternative when automation is driving it.

## Follow-up validation still in progress

- Need to verify whether an explicitly approved install path succeeds cleanly once the Python pin and other legacy build dependencies are aligned.
