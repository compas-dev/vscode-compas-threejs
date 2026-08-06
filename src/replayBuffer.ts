export class WorkspaceReplayBuffer {
  private readonly workspaces = new Map<
    string,
    { byteLength: number; messages: Uint8Array[] }
  >();

  public constructor(private maxBytesPerWorkspace: number) {}

  public setLimit(maxBytesPerWorkspace: number): void {
    this.maxBytesPerWorkspace = maxBytesPerWorkspace;
    for (const workspace of this.workspaces.keys()) {
      this.trim(workspace);
    }
  }

  public append(workspace: string, message: Uint8Array): void {
    const state = this.workspaces.get(workspace) ?? {
      byteLength: 0,
      messages: [],
    };
    const copy = Uint8Array.from(message);
    state.messages.push(copy);
    state.byteLength += copy.byteLength;
    this.workspaces.set(workspace, state);
    this.trim(workspace);
  }

  public snapshot(workspace: string): readonly Uint8Array[] {
    return [...(this.workspaces.get(workspace)?.messages ?? [])];
  }

  public clear(workspace?: string): void {
    if (workspace === undefined) {
      this.workspaces.clear();
      return;
    }
    this.workspaces.delete(workspace);
  }

  private trim(workspace: string): void {
    const state = this.workspaces.get(workspace);
    if (!state) {
      return;
    }

    // Keep the newest message even when one payload alone exceeds the limit.
    while (
      state.messages.length > 1 &&
      state.byteLength > this.maxBytesPerWorkspace
    ) {
      const removed = state.messages.shift();
      state.byteLength -= removed?.byteLength ?? 0;
    }
  }
}
