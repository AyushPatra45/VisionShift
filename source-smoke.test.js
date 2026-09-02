import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const readSource = (path) => readFileSync(resolve(projectRoot, path), "utf8");
const experiences = ["effects", "draw", "hud", "game", "sign", "pong"];

test("index exposes exactly one button and control panel for every experience", () => {
  const html = readSource("index.html");
  const buttons = [...html.matchAll(/<button\b[^>]*\bdata-experience="([^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/<div\b[^>]*\bdata-experience-panel="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(buttons, experiences);
  assert.deepEqual(panels, experiences);
});

test("app imports and routes the Sign Lab and Neon Pong modules", () => {
  const app = readSource("app.js");

  assert.match(app, /from\s+["']\.\/sign-utils\.js["']/);
  assert.match(app, /from\s+["']\.\/pong-utils\.js["']/);
  assert.match(app, /\bsign\s*:\s*\{/);
  assert.match(app, /\bpong\s*:\s*\{/);
  assert.match(app, /activeExperience\s*===\s*["']sign["']/);
  assert.match(app, /activeExperience\s*===\s*["']pong["']/);
});

test("static build includes the Sign Lab and Neon Pong utility assets", () => {
  const build = readSource("scripts/build.mjs");

  assert.match(build, /["']sign-utils\.js["']/);
  assert.match(build, /["']pong-utils\.js["']/);
});

test("high-frequency vision output uses discrete accessible announcements", () => {
  const html = readSource("index.html");
  const app = readSource("app.js");

  assert.doesNotMatch(html, /class="telemetry"[^>]*aria-live/);
  assert.doesNotMatch(html, /class="sign-challenge"[^>]*aria-live/);
  assert.match(html, /id="gestureReadout"[^>]*aria-live="polite"/);
  assert.match(html, /id="signAnnouncement"[^>]*aria-live="polite"/);
  assert.match(app, /function setTextIfChanged\(/);
});

test("Sign Lab has a dedicated phone layout", () => {
  const css = readSource("styles.css");

  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.stage\[data-experience="sign"\] \.sign-challenge/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.stage\[data-experience="sign"\] \.telemetry/);
});

test("macOS launcher verifies this app before reusing a local server", () => {
  const launcher = readSource("Start Gesture Lab.command");
  const html = readSource("index.html");
  const marker = launcher.match(/^APP_MARKER="([^"]+)"$/m)?.[1];

  assert.ok(marker, "launcher must declare an app marker");
  assert.ok(html.includes(marker), `index.html must expose the launcher marker: ${marker}`);
  assert.match(launcher, /for candidate in \{8080\.\.8099\}/);
  assert.match(launcher, /if is_visionshift "\$PORT"/);
});
