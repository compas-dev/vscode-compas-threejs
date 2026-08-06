import * as vscode from "vscode";
import { LiveServer } from "./liveServer";
import { ViewerBridge } from "./viewerBridge";

interface LivePanel {
  panel: vscode.WebviewPanel;
  bridge: ViewerBridge;
  subscription: vscode.Disposable;
}

export class LiveViewerManager implements vscode.Disposable {
  private readonly panels = new Map<string, LivePanel>();

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly server: LiveServer,
  ) {}

  public open(workspace: string): void {
    const existing = this.panels.get(workspace);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "compasThreejs.liveViewer",
      `COMPAS Live — ${workspace}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    panel.iconPath = vscode.Uri.joinPath(
      this.extensionUri,
      "media",
      "viewer",
      "compas_icon_white.png",
    );

    const bridge = new ViewerBridge(
      panel.webview,
      this.extensionUri,
      (message) => this.server.sendViewerMessage(workspace, message),
    );
    const subscription = this.server.subscribe(workspace, (bytes) =>
      bridge.dispatch(bytes),
    );
    bridge.reset();
    for (const bytes of subscription.replay) {
      bridge.dispatch(bytes);
    }

    const livePanel = { panel, bridge, subscription };
    this.panels.set(workspace, livePanel);
    panel.onDidDispose(() => {
      subscription.dispose();
      bridge.dispose();
      this.panels.delete(workspace);
    });
  }

  public clear(workspace: string): void {
    this.panels.get(workspace)?.bridge.reset();
  }

  public dispose(): void {
    for (const livePanel of this.panels.values()) {
      livePanel.subscription.dispose();
      livePanel.bridge.dispose();
      livePanel.panel.dispose();
    }
    this.panels.clear();
  }
}
