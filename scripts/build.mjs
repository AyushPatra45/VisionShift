import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(projectRoot, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "gesture-state.js",
  "cloak-utils.js",
  "interaction-utils.js",
  "sign-utils.js",
  "pong-utils.js",
];

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = resolve(projectRoot, file);
  if (!existsSync(source)) throw new Error(`Missing required build input: ${file}`);
  cpSync(source, resolve(output, file));
}

cpSync(resolve(projectRoot, "models"), resolve(output, "models"), { recursive: true });
cpSync(resolve(projectRoot, "assets"), resolve(output, "assets"), { recursive: true });
cpSync(
  resolve(projectRoot, "node_modules/@mediapipe/tasks-vision"),
  resolve(output, "node_modules/@mediapipe/tasks-vision"),
  { recursive: true },
);
writeFileSync(resolve(output, ".nojekyll"), "");

console.log("Built deployable site in dist/");
