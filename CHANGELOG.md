# Changelog

## 0.1.0 - 2026-08-14

### Added

- Open `*.compas.pb` files in a read-only COMPAS Three.js custom editor.
- Run an extension-owned WebSocket server for live Python scenes, with
  per-workspace replay and viewer callbacks.
- Copy ready-to-paste Python connection code using the dynamically assigned
  live-server port.
- Configure the live host, port, workspace, startup behavior, and replay limit.

### Integration

- Embed the public `@compas-dev/compas-threejs-ts` 1.0 viewer through its
  instance-based `createViewer` API.
- Bundle the viewer, styles, fonts, and licenses into the extension so no HTTP
  server or Node.js runtime dependency is required by users.
- Support COMPAS Protobuf 1.x binary messages and JSON viewer callbacks.
