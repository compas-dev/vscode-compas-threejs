import { describe, expect, it } from "vitest";
import { WorkspaceReplayBuffer } from "../src/replayBuffer";

describe("WorkspaceReplayBuffer", () => {
  it("keeps workspaces independent", () => {
    const replay = new WorkspaceReplayBuffer(10);
    replay.append("main", new Uint8Array([1]));
    replay.append("other", new Uint8Array([2]));

    expect([...replay.snapshot("main")[0]!]).toEqual([1]);
    expect([...replay.snapshot("other")[0]!]).toEqual([2]);
  });

  it("trims oldest messages when the byte limit is exceeded", () => {
    const replay = new WorkspaceReplayBuffer(3);
    replay.append("main", new Uint8Array([1, 2]));
    replay.append("main", new Uint8Array([3, 4]));

    expect(replay.snapshot("main")).toHaveLength(1);
    expect([...replay.snapshot("main")[0]!]).toEqual([3, 4]);
  });

  it("can clear one workspace without clearing another", () => {
    const replay = new WorkspaceReplayBuffer(10);
    replay.append("main", new Uint8Array([1]));
    replay.append("other", new Uint8Array([2]));
    replay.clear("main");

    expect(replay.snapshot("main")).toHaveLength(0);
    expect(replay.snapshot("other")).toHaveLength(1);
  });
});
