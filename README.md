# COMPAS Three.js Viewer for VS Code

An experimental Visual Studio Code extension that embeds
[`compas_threejs_ts`](https://github.com/compas-dev/compas_threejs_ts) for
two workflows:

- Open `*.compas.pb` geometry dumps as read-only 3D editors.
- Receive live COMPAS protobuf messages from Python over an extension-owned
  WebSocket server.

JSON files are intentionally out of scope for the first milestone.

## Protobuf file viewer

Create a dump with `compas_pb`:

```python
from compas.geometry import Box
from compas_pb import pb_dump

pb_dump(Box(2, 3, 1), "box.compas.pb")
```

Opening `box.compas.pb` uses the 3D viewer by default. When another process
rewrites the file, the editor clears the previous scene and reloads it
automatically while retaining the viewer and camera context.

The embedded decoder currently targets the COMPAS-Protobuf `1.x` wire format.
Older `0.x` dumps are rejected with their version shown in the viewer error.

Use **Reopen Editor With... → Text Editor** if you need to inspect a matching
file without the custom viewer.

## Live viewer

The extension asks the operating system for an available ephemeral WebSocket
port each time its live server starts. The assigned port is shown in the VS Code
status bar. Run **COMPAS: Copy Live Connection Snippet** and paste the resulting
code into Python; it uses the active port and configured workspace:

```python
from compas.geometry import Box
from compas_threejs.viewer import Remote

viewer = Remote(host="127.0.0.1", port=54321, workspace_id="main")  # copied port
viewer.connect()
viewer.add_geometry(Box(2, 3, 1))
```

The Python environment used by `Remote` must likewise resolve a `compas_pb`
version that writes the `1.x` wire format.

Messages are retained per workspace and replayed when a live viewer opens or
reopens. The configured replay memory limit discards the oldest messages first.
Viewer callbacks, such as picking and UI actions, are sent as JSON text to
connected producers in the same workspace.

### Commands

- **COMPAS: Open Live Viewer** — open or reveal the configured workspace.
- **COMPAS: Copy Live Connection Snippet** — copy ready-to-paste Python using
  the currently assigned port and workspace.
- **COMPAS: Clear Live Viewer** — clear that workspace and its replay history.
- **COMPAS: Restart Live Server** — apply host or port changes immediately.

### Settings

- `compasThreejs.live.enabled` — start the server after VS Code starts.
- `compasThreejs.live.host` — bind address; defaults to `127.0.0.1`.
- `compasThreejs.live.port` — bind port; defaults to `0`, which asks the
  operating system for an available ephemeral port. Set a non-zero value when a
  stable endpoint is required.
- `compasThreejs.live.workspace` — workspace opened by commands.
- `compasThreejs.live.replayMegabytes` — replay memory limit per workspace.

## Development

This repository expects sibling clones during frontend development:

```text
some_folder/
├── compas_threejs_ts/
└── vscode-compas-threejs/
```

Build and copy the embedded frontend, then build the extension:

```bash
npm --prefix ../compas_threejs_ts run build
npm install
npm run sync-viewer
npm run build
```

Press `F5` in VS Code to launch an Extension Development Host. Generate the
included sample with:

```bash
python examples/create_box_dump.py
```

The generated self-contained frontend under `media/viewer/` is committed so a
packaged extension has no runtime dependency on the sibling clone. Override the
library source for `npm run sync-viewer` with the `COMPAS_THREEJS_DIST`
environment variable and its build dependency directory with
`COMPAS_THREEJS_NODE_MODULES`.

## Architecture

The extension host reads protobuf files or receives binary WebSocket frames and
transfers their exact `ArrayBuffer` contents into a VS Code webview. The webview
creates an embedded `compas_threejs_ts` viewer through its public `createViewer`
API and calls the returned instance's `dispatch` method. No HTTP server, Python
interpreter, or protobuf decoding is required inside the extension host.
