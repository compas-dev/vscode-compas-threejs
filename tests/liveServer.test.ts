import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { LiveServer } from "../src/liveServer";

const servers: LiveServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe("LiveServer", () => {
  it("relays protobuf bytes to the matching workspace and records replay", async () => {
    const output: string[] = [];
    const server = new LiveServer({ appendLine: (line) => output.push(line) });
    servers.push(server);
    await server.start({ host: "127.0.0.1", port: 0, replayMegabytes: 1 });

    const received = new Promise<Uint8Array>((resolve) => {
      server.subscribe("main", resolve);
    });
    const client = await connect(`${server.endpoint}?workspace=main`);
    client.send(new Uint8Array([1, 2, 3]));

    expect([...(await received)]).toEqual([1, 2, 3]);
    const replay = server.subscribe("main", () => undefined).replay;
    expect([...replay[0]!]).toEqual([1, 2, 3]);
    expect(output.some((line) => line.includes("listening"))).toBe(true);
    client.close();
  });

  it("sends viewer callbacks to producers in the same workspace only", async () => {
    const server = new LiveServer({ appendLine: () => undefined });
    servers.push(server);
    await server.start({ host: "127.0.0.1", port: 0, replayMegabytes: 1 });

    const main = await connect(`${server.endpoint}?workspace=main`);
    const other = await connect(`${server.endpoint}?workspace=other`);
    const mainMessage = nextMessage(main);
    let otherReceived = false;
    other.once("message", () => {
      otherReceived = true;
    });

    server.sendViewerMessage("main", { dispatch: "object_picked", guid: "box" });

    expect((await mainMessage).toString()).toBe(
      '{"dispatch":"object_picked","guid":"box"}',
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(otherReceived).toBe(false);
    main.close();
    other.close();
  });
});

function connect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => resolve(Buffer.from(data as ArrayBuffer)));
    socket.once("error", reject);
  });
}
