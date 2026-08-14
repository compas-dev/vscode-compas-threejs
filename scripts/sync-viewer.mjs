import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.resolve(
  process.env.COMPAS_THREEJS_DIST ??
    path.join(projectDirectory, "../compas_threejs_ts/dist-lib"),
);
const dependencyDirectory = path.resolve(
  process.env.COMPAS_THREEJS_NODE_MODULES ??
    path.join(sourceDirectory, "../node_modules"),
);
const targetDirectory = path.join(projectDirectory, "media", "viewer");
const assets = [
  [path.join(sourceDirectory, "style.css"), "index.css"],
  [
    path.join(sourceDirectory, "licenses", "Inter-LICENSE.txt"),
    path.join("licenses", "Inter-LICENSE.txt"),
  ],
];

await mkdir(targetDirectory, { recursive: true });
await rm(path.join(targetDirectory, "vendor"), { recursive: true, force: true });

await build({
  entryPoints: [path.join(sourceDirectory, "index.js")],
  outfile: path.join(targetDirectory, "index.js"),
  bundle: true,
  define: { "process.env.NODE_ENV": '"production"' },
  format: "esm",
  minify: true,
  nodePaths: [dependencyDirectory],
  platform: "browser",
  sourcemap: false,
  target: ["chrome114"],
});

for (const [source, relativeTarget] of assets) {
  await stat(source);
  const target = path.join(targetDirectory, relativeTarget);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

console.log(`Synced COMPAS viewer assets from ${sourceDirectory}`);
