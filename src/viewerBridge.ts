import * as vscode from "vscode";
import { getViewerHtml } from "./viewerHtml";

type QueuedMessage =
  | { type: "dispatch" | "replace"; bytes: ArrayBuffer }
  | { type: "error"; message: string }
  | { type: "reset" };

export class ViewerBridge implements vscode.Disposable {
  private ready = false;
  private readonly pending: QueuedMessage[] = [];
  private readonly messageSubscription: vscode.Disposable;

  public constructor(
    private readonly webview: vscode.Webview,
    extensionUri: vscode.Uri,
    private readonly onViewerMessage?: (message: unknown) => void,
    private readonly onReady?: () => void,
  ) {
    const viewerRoot = vscode.Uri.joinPath(extensionUri, "media", "viewer");
    webview.options = {
      enableScripts: true,
      localResourceRoots: [viewerRoot],
    };
    this.messageSubscription = webview.onDidReceiveMessage((message) => {
      if (message?.type === "ready") {
        this.ready = true;
        void this.flush();
        this.onReady?.();
      } else if (message?.type === "viewer-message") {
        this.onViewerMessage?.(message.data);
      } else if (message?.type === "viewer-error") {
        console.error("COMPAS viewer webview error:", message.message);
      }
    });
    webview.html = getViewerHtml(webview, extensionUri);
  }

  public dispatch(bytes: Uint8Array): void {
    this.enqueue({ type: "dispatch", bytes: exactArrayBuffer(bytes) });
  }

  public replace(bytes: Uint8Array): void {
    for (let index = this.pending.length - 1; index >= 0; index -= 1) {
      if (this.pending[index]?.type === "replace") {
        this.pending.splice(index, 1);
      }
    }
    this.enqueue({ type: "replace", bytes: exactArrayBuffer(bytes) });
  }

  public reset(): void {
    this.enqueue({ type: "reset" });
  }

  public showError(message: string): void {
    this.enqueue({ type: "error", message });
  }

  public dispose(): void {
    this.messageSubscription.dispose();
    this.pending.length = 0;
  }

  private enqueue(message: QueuedMessage): void {
    if (!this.ready) {
      this.pending.push(message);
      return;
    }
    void this.webview.postMessage(message);
  }

  private async flush(): Promise<void> {
    while (this.ready && this.pending.length > 0) {
      const message = this.pending.shift();
      if (message) {
        await this.webview.postMessage(message);
      }
    }
  }
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}
