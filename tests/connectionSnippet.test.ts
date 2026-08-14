import { describe, expect, it } from "vitest";
import { createConnectionSnippet } from "../src/connectionSnippet";

describe("createConnectionSnippet", () => {
  it("creates ready-to-paste Python for the assigned endpoint and workspace", () => {
    expect(
      createConnectionSnippet("ws://127.0.0.1:54321/ws", "detail"),
    ).toBe(
      [
        "from compas_threejs.viewer import Remote",
        "",
        'viewer = Remote(host="127.0.0.1", port=54321, workspace_id="detail")',
        "viewer.connect()",
      ].join("\n"),
    );
  });

  it("rejects an endpoint without an assigned port", () => {
    expect(() =>
      createConnectionSnippet("ws://127.0.0.1/ws", "main"),
    ).toThrow("invalid port");
  });
});
