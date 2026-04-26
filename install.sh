#!/usr/bin/env sh
set -eu

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

mkdir -p "$HOME/.hermes/dashboard-themes" "$HOME/.hermes/plugins"
cp "$SOURCE_DIR/theme/hermes-amp.yaml" "$HOME/.hermes/dashboard-themes/"
rm -rf "$HOME/.hermes/plugins/hermes-amp"
mkdir -p "$HOME/.hermes/plugins/hermes-amp"
cp -R "$SOURCE_DIR/dashboard" "$HOME/.hermes/plugins/hermes-amp/"

# The bundled dashboard example plugin injects a sessions banner that competes
# with this skin. User plugins win discovery priority, so install a hidden
# no-op plugin with the same name for clean demo screenshots.
rm -rf "$HOME/.hermes/plugins/example"
mkdir -p "$HOME/.hermes/plugins/example"
cp -R "$SOURCE_DIR/demo-overrides/example/dashboard" "$HOME/.hermes/plugins/example/"

printf '%s\n' "Installed Hermes Amp."
printf '%s\n' "Theme:  $HOME/.hermes/dashboard-themes/hermes-amp.yaml"
printf '%s\n' "Plugin: $HOME/.hermes/plugins/hermes-amp/dashboard"
printf '%s\n' "Demo:   $HOME/.hermes/plugins/example/dashboard shadows the bundled example plugin"
printf '%s\n' "Restart 'hermes dashboard' or run:"
printf '%s\n' "curl http://127.0.0.1:9119/api/dashboard/plugins/rescan"
