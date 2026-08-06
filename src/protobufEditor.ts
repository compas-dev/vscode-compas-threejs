import * as path from "node:path";
import * as vscode from "vscode";
import { ViewerBridge } from "./viewerBridge";

class ProtobufDocument implements vscode.CustomDocument {
  public constructor(public readonly uri: vscode.Uri) {}
  public dispose(): void {}
}

export class ProtobufEditorProvider
  implements vscode.CustomReadonlyEditorProvider<ProtobufDocument>
{
  public static readonly viewType = "compasThreejs.protobufViewer";

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly output: vscode.OutputChannel,
  ) {}

  public openCustomDocument(uri: vscode.Uri): ProtobufDocument {
    return new ProtobufDocument(uri);
  }

  public async resolveCustomEditor(
    document: ProtobufDocument,
    webviewPanel: vscode.WebviewPanel,
  ): Promise<void> {
    const bridge = new ViewerBridge(webviewPanel.webview, this.extensionUri);
    const disposables: vscode.Disposable[] = [bridge];
    let refreshSequence = 0;
    let refreshTimer: NodeJS.Timeout | undefined;

    const refresh = async (): Promise<void> => {
      const sequence = ++refreshSequence;
      try {
        const bytes = await vscode.workspace.fs.readFile(document.uri);
        if (sequence === refreshSequence) {
          bridge.replace(bytes);
        }
      } catch (error) {
        const message = `Unable to read ${document.uri.fsPath}: ${formatError(error)}`;
        this.output.appendLine(message);
        bridge.showError(message);
      }
    };

    const scheduleRefresh = (): void => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => void refresh(), 75);
    };

    const parent = document.uri.with({
      path: path.posix.dirname(document.uri.path),
    });
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(parent, path.posix.basename(document.uri.path)),
    );
    disposables.push(
      watcher,
      watcher.onDidChange(scheduleRefresh),
      watcher.onDidCreate(scheduleRefresh),
      watcher.onDidDelete(() =>
        bridge.showError(`The file was deleted: ${document.uri.fsPath}`),
      ),
    );

    webviewPanel.onDidDispose(() => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });

    await refresh();
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
