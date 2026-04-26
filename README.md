# Hermes Amp

Late-90s media-player dashboard chrome for Hermes. Hermes Amp is intentionally Winamp-adjacent without copying Winamp branding or assets: compact snapped windows, graphite bevels, LCD readouts, playlist-style sessions, tiny status LEDs, scanlines, and a functional data-mixer equalizer.

The goal is not just a visual reskin. The Sessions page becomes a usable agent cockpit where the playlist, inspector, transport controls, meters, logs, and visualizer all map to Hermes dashboard data.

## Highlights

- Replaces `/sessions` with a full media-player workspace.
- Adds a functional `EQUALIZER` data mixer with persistent local settings.
- Adds signal meters for health, token activity, API volume, cache reads, and log error pressure.
- Adds a read-only `CRON DECK` for armed, due, paused, and failed scheduled jobs.
- Turns the visualizer into a chart lens for `MSG`, `TOK`, `API`, `COST`, `LOG`, `ERR`, `WARN`, `CACHE`, and `RUNS`.
- Uses `REC` to bias charts toward newer activity.
- Shows a mixer-driven preview waveform when no matching live data exists yet.
- Adds a selectable session playlist and `SESSION INSPECTOR`.
- Keeps transport controls practical: `+ CHAT`, `# LOGS`, `^ STATS`, `* SYNC`.
- Ships as a drop-in dashboard theme plus dashboard plugin. No Hermes fork required.

## What It Includes

- `theme/hermes-amp.yaml` - dashboard theme with cockpit layout, compact density, square chrome, graphite/cyan metal, and green LCD accents.
- `dashboard/manifest.json` - hidden slot-only dashboard plugin.
- `dashboard/dist/index.js` - SDK-based plugin bundle. No React build step required.
- `dashboard/dist/style.css` - plugin-specific styling.
- `dashboard/dist/index.amp15.js` and `dashboard/dist/style.amp15.css` - manifest-pinned cache-busted release assets.
- `demo-overrides/example` - a hidden no-op user plugin that shadows Hermes' bundled Example plugin so demo screenshots are clean.

## Dashboard Slots

- `header-left` - Hermes Amp identity plate.
- `header-right` - agent status LED and version/status readout.
- `pre-main` - mobile-visible agent stream strip with functional controls and live activity summary.
- `sidebar` - now-playing panel, equalizer, signal meters, and recent-session playlist.
- `footer-right` - media-stream style tagline.
- `overlay` - subtle vertical chrome.
- `logs:top` and `sessions:top` - compact page banners.

## Functional Visualizer

The animated visualizer is data-driven. It reads dashboard status, recent sessions, usage analytics, and log tail data via the dashboard SDK. The equalizer acts as a local chart mixer: raising or lowering `MSG`, `TOK`, `API`, `COST`, `LOG`, `ERR`, `WARN`, `CACHE`, or `RUNS` changes the visualizer lens, while `REC` biases the graph toward newer activity.

If there is no matching live data yet, the chart switches to a mixer-driven preview signal so the controls still visibly respond. Mixer settings persist to `localStorage` under `hermes-amp-mix-v1`.

## Session Workspace

The Sessions page is replaced by a Winamp-style workspace: main player, selectable playlist, functional equalizer, signal meters, cron deck, log tail, and a session inspector. The inspector can resume a session, load a transcript preview, and delete a session after explicit browser confirmation.

The plugin overrides `/sessions`, so the Sessions nav item becomes the Hermes Amp workspace. The underlying data still comes from Hermes dashboard APIs.

Transport controls:

- `+ CHAT` opens the embedded Hermes chat.
- `> SESS` returns to Sessions from cross-page banners.
- `# LOGS` opens Logs.
- `^ STATS` opens Analytics.
- `* SYNC` refreshes the Hermes Amp HUD data immediately.

The `/sessions` cockpit omits `SESS` because it is already on the workspace route.

## Installation

From this directory:

```sh
./install.sh
```

Or manually:

```sh
mkdir -p ~/.hermes/dashboard-themes ~/.hermes/plugins
cp theme/hermes-amp.yaml ~/.hermes/dashboard-themes/
cp -R . ~/.hermes/plugins/hermes-amp
```

After install, restart `hermes dashboard` or rescan plugins:

```sh
curl http://127.0.0.1:9119/api/dashboard/plugins/rescan
```

Then open the dashboard, click the palette icon, and choose `Hermes Amp`.

## Validation

These checks were used during development:

```sh
node --check dashboard/dist/index.js
node --check dashboard/dist/index.amp15.js
jq . dashboard/manifest.json
ruby -e 'require "yaml"; YAML.load_file("theme/hermes-amp.yaml")'
```

Live checks:

- Install with `./install.sh`.
- Rescan plugins with `curl http://127.0.0.1:9119/api/dashboard/plugins/rescan`.
- Open `http://127.0.0.1:9119/sessions`.
- Confirm the `HERMES.AMP WORKSPACE` replaces the native Sessions page.
- Confirm the mixer presets change the chart lens and visualizer shape.
- Confirm `SESSION INSPECTOR` replaces redundant shortcut panels.
- Confirm `CRON DECK` shows scheduled jobs or a no-job empty state.

## Design Notes

The skin should feel nostalgic, but still usable. The theme owns the global dashboard chrome; the plugin owns functional HUD details. That separation keeps the contest entry drop-in and avoids forking Hermes.

Hermes Amp uses original CSS and dashboard SDK code only. It does not bundle Winamp images, skins, logos, or proprietary assets.

The dashboard extension reference is here: https://hermes-agent.nousresearch.com/docs/user-guide/features/extending-the-dashboard
