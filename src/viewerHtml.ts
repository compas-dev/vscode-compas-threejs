import * as crypto from "node:crypto";
import * as vscode from "vscode";

export function getViewerHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
): string {
  const viewerRoot = vscode.Uri.joinPath(extensionUri, "media", "viewer");
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(viewerRoot, "index.js"),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(viewerRoot, "index.css"),
  );
  const nonce = crypto.randomBytes(16).toString("base64");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>COMPAS Three.js Viewer</title>
    <style>
      html, body, #viewer { width: 100%; height: 100%; padding: 0; margin: 0; overflow: hidden; }
      #compas-host-error {
        display: none;
        position: fixed;
        z-index: 100000;
        inset: 16px 16px auto 16px;
        padding: 12px 14px;
        border: 1px solid var(--vscode-inputValidation-errorBorder);
        border-radius: 4px;
        color: var(--vscode-errorForeground);
        background: var(--vscode-inputValidation-errorBackground);
        font-family: var(--vscode-font-family);
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <div id="viewer"></div>
    <div id="compas-host-error" role="alert"></div>
    <script type="module" nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const errorElement = document.getElementById("compas-host-error");
      const viewerElement = document.getElementById("viewer");
      let viewer;

      function showError(value) {
        const message = value instanceof Error ? value.message : String(value);
        errorElement.textContent = message;
        errorElement.style.display = "block";
      }

      function clearError() {
        errorElement.textContent = "";
        errorElement.style.display = "none";
      }

      window.addEventListener("message", (event) => {
        const message = event.data;
        try {
          if (message.type === "reset") {
            viewer.reset();
            clearError();
            return;
          }
          if (message.type === "replace") {
            viewer.reset();
          }
          if (message.type === "replace" || message.type === "dispatch") {
            viewer.dispatch(new Uint8Array(message.bytes));
            clearError();
            return;
          }
          if (message.type === "error") {
            showError(message.message);
          }
        } catch (error) {
          showError(error);
          vscode.postMessage({ type: "viewer-error", message: String(error) });
        }
      });

      try {
        const { createViewer } = await import(${JSON.stringify(scriptUri.toString())});
        viewer = createViewer(viewerElement, {
          mode: "embedded",
          defaultLighting: true,
          showToolbar: false,
          send(message) {
            vscode.postMessage({ type: "viewer-message", data: message });
            return true;
          },
          onError(error) {
            showError(error);
            vscode.postMessage({ type: "viewer-error", message: String(error) });
          },
        });
        vscode.postMessage({ type: "ready" });
      } catch (error) {
        showError(error);
        vscode.postMessage({ type: "viewer-error", message: String(error) });
      }

      window.addEventListener("pagehide", () => viewer?.dispose(), { once: true });
    </script>
  </body>
</html>`;
}
