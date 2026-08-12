export function createConnectionSnippet(
  endpoint: string,
  workspace: string,
): string {
  const url = new URL(endpoint);
  const port = Number.parseInt(url.port, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Live server endpoint has an invalid port: ${endpoint}`);
  }

  return [
    "from compas_threejs.viewer import Remote",
    "",
    `viewer = Remote(host=${JSON.stringify(url.hostname)}, port=${port}, workspace_id=${JSON.stringify(workspace)})`,
    "viewer.connect()",
  ].join("\n");
}
