import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.resolve(
  process.env.COMPAS_THREEJS_DIST ?? path.join(projectDirectory, "../compas_threejs_ts/dist"),
  "assets",
);
const targetDirectory = path.join(projectDirectory, "media", "viewer");
const assets = ["index.js", "index.css", "compas_icon_white.png"];

await mkdir(targetDirectory, { recursive: true });

for (const asset of assets) {
  const source = path.join(sourceDirectory, asset);
  await stat(source);
  await copyFile(source, path.join(targetDirectory, asset));
}

console.log(`Synced COMPAS viewer assets from ${sourceDirectory}`);
