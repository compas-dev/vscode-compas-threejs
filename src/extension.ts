import * as vscode from "vscode";
import { createConnectionSnippet } from "./connectionSnippet";
import { LiveServer, type LiveServerOptions } from "./liveServer";
import { LiveViewerManager } from "./liveViewer";
import { ProtobufEditorProvider } from "./protobufEditor";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("COMPAS Three.js Viewer");
  const server = new LiveServer(output);
  const liveViewers = new LiveViewerManager(context.extensionUri, server);
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  status.command = "compasThreejs.openLiveViewer";
  status.tooltip = "Open the COMPAS Three.js live viewer";
  status.show();

  let startPromise: Promise<void> | undefined;

  const updateStatus = (): void => {
    if (!server.isRunning) {
      status.text = "$(circle-slash) COMPAS Live";
      status.tooltip = "COMPAS live server is stopped";
      return;
    }
    status.text = `$(broadcast) COMPAS :${server.port} (${server.clientCount})`;
    status.tooltip = `${server.endpoint}\n${server.clientCount} connected client(s)\nUse “COMPAS: Copy Live Connection Snippet” to copy Python connection code.`;
  };

  const ensureServer = async (interactive: boolean): Promise<boolean> => {
    if (server.isRunning) {
      return true;
    }
    if (!startPromise) {
      startPromise = server.start(readLiveOptions()).finally(() => {
        startPromise = undefined;
      });
    }
    try {
      await startPromise;
      updateStatus();
      return true;
    } catch (error) {
      const message = `Could not start the COMPAS live server: ${formatError(error)}`;
      output.appendLine(message);
      updateStatus();
      if (interactive) {
        void vscode.window.showErrorMessage(message);
      }
      return false;
    }
  };

  context.subscriptions.push(
    output,
    server,
    liveViewers,
    status,
    server.onDidChange(updateStatus),
    vscode.window.registerCustomEditorProvider(
      ProtobufEditorProvider.viewType,
      new ProtobufEditorProvider(context.extensionUri, output),
      {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: { retainContextWhenHidden: true },
      },
    ),
    vscode.commands.registerCommand(
      "compasThreejs.openLiveViewer",
      async () => {
        if (await ensureServer(true)) {
          liveViewers.open(readWorkspace());
        }
      },
    ),
    vscode.commands.registerCommand(
      "compasThreejs.copyConnectionSnippet",
      async () => {
        if (!(await ensureServer(true)) || !server.endpoint) {
          return;
        }
        const snippet = createConnectionSnippet(server.endpoint, readWorkspace());
        await vscode.env.clipboard.writeText(snippet);
        void vscode.window.showInformationMessage(
          `Copied COMPAS connection snippet for port ${server.port}.`,
        );
      },
    ),
    vscode.commands.registerCommand(
      "compasThreejs.restartLiveServer",
      async () => {
        await server.stop();
        if (await ensureServer(true)) {
          void vscode.window.showInformationMessage(
            `COMPAS live server listening at ${server.endpoint}`,
          );
        }
      },
    ),
    vscode.commands.registerCommand("compasThreejs.clearLiveViewer", () => {
      const workspace = readWorkspace();
      server.clear(workspace);
      liveViewers.clear(workspace);
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!event.affectsConfiguration("compasThreejs.live")) {
        return;
      }
      await server.stop();
      if (isLiveEnabled()) {
        await ensureServer(false);
      }
    }),
  );

  updateStatus();
  if (isLiveEnabled()) {
    void ensureServer(false);
  }
}

function isLiveEnabled(): boolean {
  return vscode.workspace
    .getConfiguration("compasThreejs.live")
    .get("enabled", true);
}

function readWorkspace(): string {
  return (
    vscode.workspace
      .getConfiguration("compasThreejs.live")
      .get("workspace", "main")
      .trim() || "main"
  );
}

function readLiveOptions(): LiveServerOptions {
  const configuration = vscode.workspace.getConfiguration("compasThreejs.live");
  return {
    host: configuration.get("host", "127.0.0.1"),
    port: configuration.get("port", 0),
    replayMegabytes: configuration.get("replayMegabytes", 256),
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
