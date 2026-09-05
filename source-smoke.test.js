import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const readSource = (path) => readFileSync(resolve(projectRoot, path), "utf8");
const experiences = ["effects", "draw", "hud", "game", "sign", "pong", "reader"];

function extractInlineScript(html, marker) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
  const script = scripts.find((candidate) => candidate.includes(marker));
  assert.ok(script, `missing inline script containing ${marker}`);
  return script;
}

function createFakeElement(dataset = {}) {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();

  return {
    dataset: { ...dataset },
    textContent: "",
    innerHTML: "",
    disabled: false,
    childrenBySelector: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => attributes.get(name),
    addEventListener(type, listener) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    click() {
      this.dispatch("click", { currentTarget: this });
    },
    querySelector(selector) {
      return this.childrenBySelector[selector] ?? null;
    },
  };
}

test("index exposes exactly one button and control panel for every experience", () => {
  const html = readSource("index.html");
  const buttons = [...html.matchAll(/<button\b[^>]*\bdata-experience="([^"]+)"/g)].map((match) => match[1]);
  const panels = [...html.matchAll(/<div\b[^>]*\bdata-experience-panel="([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(buttons, experiences);
  assert.deepEqual(panels, experiences);
});

test("app imports and routes the Sign Lab, Neon Pong, and Sign Reader modules", () => {
  const app = readSource("app.js");

  assert.match(app, /from\s+["']\.\/sign-utils\.js["']/);
  assert.match(app, /from\s+["']\.\/pong-utils\.js["']/);
  assert.match(app, /from\s+["']\.\/sign-reader-utils\.js["']/);
  assert.match(app, /\bsign\s*:\s*\{/);
  assert.match(app, /\bpong\s*:\s*\{/);
  assert.match(app, /activeExperience\s*===\s*["']sign["']/);
  assert.match(app, /activeExperience\s*===\s*["']pong["']/);
  assert.match(app, /activeExperience\s*===\s*["']reader["']/);
  assert.match(app, /window\.addEventListener\(["']visionshift:experience["']/);
  assert.match(app, /setExperience\(event\.detail\?\.experience\)/);
});

test("static build includes the experience utility assets", () => {
  const build = readSource("scripts/build.mjs");

  assert.match(build, /["']sign-utils\.js["']/);
  assert.match(build, /["']pong-utils\.js["']/);
  assert.match(build, /["']sign-reader-utils\.js["']/);
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

test("Personal Sign Reader exposes training controls and a phone layout", () => {
  const html = readSource("index.html");
  const css = readSource("styles.css");

  for (const id of ["readerLabelInput", "teachSignButton", "undoReaderButton", "speakReaderButton", "clearReaderButton", "forgetSignsButton"]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  assert.match(html, /signer-specific static-pose reader/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*\.stage\[data-experience="reader"\] \.reader-output/);
});

test("Air Canvas uses a latched pinch gate and continuous curved strokes", () => {
  const app = readSource("app.js");

  assert.match(app, /new PinchGate\(/);
  assert.match(app, /smoothCanvasPoint\(/);
  assert.match(app, /quadraticCurveTo\(/);
  assert.match(app, /else if \(!point && drawingActive\)/);
});

test("Pages workflow keeps CI green until repository Pages is enabled", () => {
  const workflow = readSource(".github/workflows/pages.yml");

  assert.match(workflow, /id: pages-status/);
  assert.match(workflow, /pages-enabled: \$\{\{ steps\.pages-status\.outputs\.enabled \}\}/);
  assert.match(workflow, /if: steps\.pages-status\.outputs\.enabled == 'true'/);
  assert.match(workflow, /if: needs\.build\.outputs\.pages-enabled == 'true'/);
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

test("file mode replaces generic loading with actionable launcher help", () => {
  const html = readSource("index.html");
  const startupScript = extractInlineScript(html, "function showStartupHelp");
  const panel = createFakeElement();
  const panelTitle = createFakeElement();
  const panelDescription = createFakeElement();
  const startButton = createFakeElement();
  const note = createFakeElement();
  const status = createFakeElement();
  const statusText = createFakeElement();
  const modeChip = createFakeElement();
  panel.childrenBySelector.h2 = panelTitle;
  panel.childrenBySelector.p = panelDescription;
  statusText.textContent = "MODEL LOADING";
  note.textContent = "Loading hand tracking…";

  const elements = new Map([
    ["#permissionPanel", panel],
    ["#startButton", startButton],
    ["#loadNote", note],
    [".status", status],
    ["#statusText", statusText],
    ["#modeChip", modeChip],
  ]);
  const redirects = [];
  const location = { protocol: "file:", replace(url) { redirects.push(url); } };
  class FakeImage {
    static instances = [];
    constructor() { FakeImage.instances.push(this); }
    set src(value) { this.url = value; }
  }

  vm.runInNewContext(startupScript, {
    window: { location },
    document: { querySelector: (selector) => elements.get(selector) },
    Image: FakeImage,
  });

  assert.equal(statusText.textContent, "OPEN THROUGH LOCALHOST");
  assert.notEqual(statusText.textContent, "MODEL LOADING");
  assert.equal(panelTitle.textContent, "Use the VisionShift launcher");
  assert.match(startButton.innerHTML, /START VISION SHIFT\.command/);
  assert.match(note.innerHTML, /START VISION SHIFT\.command/);
  assert.equal(modeChip.textContent, "PREVIEW ONLY");
  assert.equal(startButton.disabled, true);
  assert.equal(status.classList.contains("error"), true);
  assert.equal(FakeImage.instances.length, 20);
  assert.match(FakeImage.instances[4].url, /127\.0\.0\.1:8084\/assets\/visionshift-health\.svg/);
  FakeImage.instances[4].onload();
  FakeImage.instances[5].onload();
  assert.deepEqual(redirects, ["http://127.0.0.1:8084/"]);
});

test("hosted module failure keeps navigation available and offers a working reload", () => {
  const html = readSource("index.html");
  const startupScript = extractInlineScript(html, "function showStartupHelp");
  const panel = createFakeElement();
  const panelTitle = createFakeElement();
  const panelDescription = createFakeElement();
  const startButton = createFakeElement();
  const note = createFakeElement();
  const status = createFakeElement();
  const statusText = createFakeElement();
  const modeChip = createFakeElement();
  const appScript = createFakeElement();
  panel.childrenBySelector.h2 = panelTitle;
  panel.childrenBySelector.p = panelDescription;

  const elements = new Map([
    ["#permissionPanel", panel],
    ["#startButton", startButton],
    ["#loadNote", note],
    [".status", status],
    ["#statusText", statusText],
    ["#modeChip", modeChip],
  ]);
  let reloads = 0;
  const window = {
    location: {
      protocol: "https:",
      hostname: "ayushpatra45.github.io",
      reload() { reloads += 1; },
    },
  };

  vm.runInNewContext(startupScript, {
    window,
    document: {
      head: { appendChild(element) { assert.equal(element, appScript); } },
      createElement(tag) { assert.equal(tag, "script"); return appScript; },
      querySelector: (selector) => elements.get(selector),
    },
    Image: class {},
  });

  assert.equal(appScript.type, "module");
  assert.equal(appScript.src, "./app.js");
  appScript.dispatch("error");
  assert.equal(statusText.textContent, "APP LOAD ERROR");
  assert.equal(modeChip.textContent, "MENU AVAILABLE");
  assert.equal(startButton.disabled, false);
  assert.equal(startButton.innerHTML, "Reload VisionShift");
  assert.match(note.textContent, /deployment may still be updating/);
  startButton.click();
  assert.equal(reloads, 1);
});

test("all experience buttons independently route the no-module shell", () => {
  const html = readSource("index.html");
  const shellScript = extractInlineScript(html, "window.VisionShiftShell");
  const buttons = experiences.map((experience) => createFakeElement({ experience }));
  const panels = experiences.map((experiencePanel) => createFakeElement({ experiencePanel }));
  const stage = createFakeElement();
  const eyebrow = createFakeElement();
  const description = createFakeElement();
  const stageExperience = createFakeElement();
  const captureRow = createFakeElement();
  const events = [];
  const elements = new Map([
    ["#stage", stage],
    ["#experienceEyebrow", eyebrow],
    ["#experienceDescription", description],
    ["#stageExperience", stageExperience],
    ["#captureRow", captureRow],
  ]);
  const window = { dispatchEvent: (event) => events.push(event) };
  class FakeCustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  vm.runInNewContext(shellScript, {
    window,
    CustomEvent: FakeCustomEvent,
    document: {
      querySelector: (selector) => elements.get(selector),
      querySelectorAll: (selector) => selector === ".experience-button" ? buttons : panels,
    },
  });

  assert.deepEqual([...window.VisionShiftShell.experiences], experiences);
  const routedHeadings = new Set();
  const routedStageLabels = new Set();

  experiences.forEach((experience, index) => {
    buttons[index].click();
    assert.equal(window.VisionShiftShell.activeExperience, experience);
    assert.equal(stage.dataset.experience, experience);
    assert.equal(buttons.filter((button) => button.classList.contains("active")).length, 1);
    assert.equal(buttons[index].getAttribute("aria-pressed"), "true");
    assert.equal(panels.filter((panel) => panel.classList.contains("active")).length, 1);
    assert.equal(panels[index].classList.contains("active"), true);
    assert.equal(captureRow.classList.contains("hidden"), experience !== "effects");
    assert.equal(events.at(-1).type, "visionshift:experience");
    assert.equal(events.at(-1).detail.experience, experience);
    routedHeadings.add(eyebrow.textContent);
    routedStageLabels.add(stageExperience.textContent);
  });

  assert.equal(routedHeadings.size, experiences.length);
  assert.equal(routedStageLabels.size, experiences.length);
});

test("static build emits the inline shell UI and localhost health marker", () => {
  const result = spawnSync(process.execPath, ["scripts/build.mjs"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(readSource("dist/index.html"), /window\.VisionShiftShell/);
  assert.match(readSource("dist/index.html"), /showStartupHelp\("file"\)/);
  assert.equal(existsSync(resolve(projectRoot, "dist/assets/visionshift-health.svg")), true);
});

test("START VISION SHIFT.command is executable and delegates to the verified launcher", () => {
  const friendlyLauncher = resolve(projectRoot, "START VISION SHIFT.command");
  const verifiedLauncher = resolve(projectRoot, "Start Gesture Lab.command");

  assert.equal(existsSync(friendlyLauncher), true);
  assert.notEqual(statSync(friendlyLauncher).mode & 0o111, 0, "friendly launcher must be executable");
  assert.notEqual(statSync(verifiedLauncher).mode & 0o111, 0, "verified launcher must be executable");
  assert.match(readFileSync(friendlyLauncher, "utf8"), /exec "\$\{0:A:h\}\/Start Gesture Lab\.command"/);

  if (existsSync("/bin/zsh")) {
    for (const launcher of [friendlyLauncher, verifiedLauncher]) {
      const syntax = spawnSync("/bin/zsh", ["-n", launcher], { encoding: "utf8" });
      assert.equal(syntax.status, 0, syntax.stderr);
    }
  }
});
