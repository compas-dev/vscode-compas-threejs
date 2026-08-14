import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import type * as vscode from "vscode";
import {
  WebSocket,
  WebSocketServer,
  type RawData,
  type ServerOptions,
} from "ws";
import { WorkspaceReplayBuffer } from "./replayBuffer";

export interface LiveServerOptions {
  host: string;
  port: number;
  replayMegabytes: number;
}

export interface ViewerSubscription extends vscode.Disposable {
  replay: readonly Uint8Array[];
}

export class LiveServer implements vscode.Disposable {
  private server: WebSocketServer | undefined;
  private readonly clientWorkspaces = new Map<WebSocket, string>();
  private readonly viewers = new Map<
    string,
    Set<(message: Uint8Array) => void>
  >();
  private readonly replay = new WorkspaceReplayBuffer(256 * 1024 * 1024);
  private readonly changes = new EventEmitter();
  private endpointValue: string | undefined;

  public constructor(
    private readonly output: Pick<vscode.OutputChannel, "appendLine">,
  ) {}

  public get isRunning(): boolean {
    return this.server !== undefined;
  }

  public get endpoint(): string | undefined {
    return this.endpointValue;
  }

  public get port(): number | undefined {
    const address = this.server?.address();
    return address && typeof address !== "string" ? address.port : undefined;
  }

  public get clientCount(): number {
    return this.clientWorkspaces.size;
  }

  public readonly onDidChange = (
    listener: () => void,
  ): vscode.Disposable => {
    this.changes.on("change", listener);
    return { dispose: () => this.changes.off("change", listener) };
  };

  public async start(options: LiveServerOptions): Promise<void> {
    if (this.server) {
      return;
    }

    this.replay.setLimit(options.replayMegabytes * 1024 * 1024);
    const serverOptions: ServerOptions = {
      host: options.host,
      port: options.port,
      maxPayload: 256 * 1024 * 1024,
    };
    const server = new WebSocketServer(serverOptions);
    this.attachServer(server);

    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error): void => {
        server.off("listening", handleListening);
        reject(error);
      };
      const handleListening = (): void => {
        server.off("error", handleError);
        resolve();
      };
      server.once("error", handleError);
      server.once("listening", handleListening);
    });

    this.server = server;
    const address = server.address() as AddressInfo;
    this.endpointValue = `ws://${options.host}:${address.port}/ws`;
    server.on("error", (error) =>
      this.output.appendLine(`Live server error: ${error.message}`),
    );
    this.output.appendLine(`Live server listening at ${this.endpointValue}`);
    this.emitChange();
  }

  public async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    this.endpointValue = undefined;

    for (const client of this.clientWorkspaces.keys()) {
      client.terminate();
    }
    this.clientWorkspaces.clear();

    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      this.output.appendLine("Live server stopped");
    }
    this.emitChange();
  }

  public subscribe(
    workspace: string,
    listener: (message: Uint8Array) => void,
  ): ViewerSubscription {
    const listeners = this.viewers.get(workspace) ?? new Set();
    listeners.add(listener);
    this.viewers.set(workspace, listeners);
    const replay = this.replay.snapshot(workspace);

    return {
      replay,
      dispose: () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.viewers.delete(workspace);
        }
      },
    };
  }

  public sendViewerMessage(workspace: string, message: unknown): void {
    let serialized: string;
    try {
      serialized = JSON.stringify(message);
    } catch (error) {
      this.output.appendLine(`Could not serialize viewer message: ${formatError(error)}`);
      return;
    }

    for (const [client, clientWorkspace] of this.clientWorkspaces) {
      if (clientWorkspace === workspace && client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  public clear(workspace?: string): void {
    this.replay.clear(workspace);
  }

  public dispose(): void {
    this.changes.removeAllListeners();
    void this.stop();
  }

  private attachServer(server: WebSocketServer): void {
    server.on("connection", (socket, request) => {
      const url = new URL(request.url ?? "/", "ws://localhost");
      if (url.pathname !== "/ws") {
        socket.close(1008, "Expected /ws");
        return;
      }

      const workspace = url.searchParams.get("workspace") || "main";
      this.clientWorkspaces.set(socket, workspace);
      this.output.appendLine(`Live client connected to workspace '${workspace}'`);
      this.emitChange();

      socket.on("message", (data, isBinary) => {
        if (!isBinary) {
          this.output.appendLine(
            `Ignored text message from live client in workspace '${workspace}'`,
          );
          return;
        }
        const bytes = rawDataToUint8Array(data);
        this.replay.append(workspace, bytes);
        for (const listener of this.viewers.get(workspace) ?? []) {
          listener(bytes);
        }
      });

      socket.on("close", () => {
        this.clientWorkspaces.delete(socket);
        this.output.appendLine(`Live client disconnected from workspace '${workspace}'`);
        this.emitChange();
      });
      socket.on("error", (error) =>
        this.output.appendLine(`Live client error: ${error.message}`),
      );
    });
  }

  private emitChange(): void {
    this.changes.emit("change");
  }
}

function rawDataToUint8Array(data: RawData): Uint8Array {
  if (Array.isArray(data)) {
    const length = data.reduce((total, part) => total + part.byteLength, 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const part of data) {
      result.set(part, offset);
      offset += part.byteLength;
    }
    return result;
  }
  return Uint8Array.from(new Uint8Array(data));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
