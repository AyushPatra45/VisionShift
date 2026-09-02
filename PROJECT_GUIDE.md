# VisionShift Project Guide

## Product structure

VisionShift runs one hand-recognition pass for each usable video frame and routes the shared result into the selected experience. This keeps the gesture labels and landmark coordinates consistent while avoiding a separate hand model for every module. Reality FX also uses a person-segmentation model when the cloak needs a foreground mask.

The experience switcher changes presentation and render logic; it does not restart the camera or duplicate the recognition pipeline.

## Shared vision result

MediaPipe Gesture Recognizer returns four useful data groups:

- `gestures`: a canned gesture category and confidence score;
- `landmarks`: 21 normalized 3D hand points;
- `worldLandmarks`: metric-like 3D landmark coordinates;
- `handedness`: left/right hand classification.

VisionShift uses the gesture, confidence, normalized landmarks, and handedness. Gesture-driven mode changes are stabilized across several frames so a brief accidental pose does not immediately switch an effect. Geometry-driven interactions such as pinching, drawing, and games use the landmarks directly.

## Experience internals

### 01 · Reality FX

The effect router maps stable gestures to `normal`, `invisible`, `glitch`, or `echo`.

- **Cloak:** Image Segmenter produces a soft person-confidence mask. A captured clean plate is brightness-normalized from small live border samples, then composited only inside that feathered mask. Live pixels outside the detected person remain live.
- **Glitch:** horizontal slices of the live frame are shifted and screen-blended with accent colors.
- **Echo:** recent frames are cached and redrawn with changing scale, opacity, and blend modes.

The cloak is reference-based, not scene reconstruction: the camera must stay fixed after the empty background is captured.

### 02 · Air Canvas

The distance between landmark 4 (thumb tip) and landmark 8 (index tip) determines whether the hand is pinching. A pinch paints a smoothed line onto a persistent offscreen canvas. An open palm switches that canvas to `destination-out` compositing to erase. Victory cycles the palette, and a held fist clears the drawing.

### 03 · Hand HUD

The HUD maps normalized landmark coordinates into canvas pixels and draws the official hand-connection pairs. Fingertips use larger markers, while the tracking overlay reports the active gesture, confidence, and handedness.

### 04 · Orb Game

The index fingertip acts as a pointer. A circle hit-test checks whether it is inside the target when a new pinch begins. Each hit moves the target, emits particles, increases the score, and grows the streak. Pinch latching prevents one long pinch from counting as repeated hits.

### 05 · Sign Lab

`sign-utils.js` converts the 21 landmarks into five boolean finger-extension states. Those states are compared with simplified patterns for **B**, **I**, **L**, **Y**, and **I love you**. A correct match must remain stable for the hold timer before the lesson advances.

This is deliberately described as static handshape practice—not translation or accessibility technology. It does not model movement, precise orientation and location, facial/non-manual markers, grammar, regional variation, or two-hand interaction. Expanding it into a meaningful sign-language product would require appropriate datasets, evaluation with native signers, and close collaboration with Deaf communities.

### 06 · Neon Pong

The tracked hand position controls a vertically constrained paddle. `pong-utils.js` advances the ball, reflects it from the top, bottom, and far wall, checks paddle overlap, and emits `hit` or `miss` events. Hits raise the score and speed; misses consume lives. A held fist resets game state.

Frame-time normalization keeps movement reasonably consistent across different camera/render frame rates, while speed and paddle bounds remain in canvas coordinates.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | Product layout, six-experience picker, controls, status, and explanatory copy |
| `styles.css` | Responsive visual system and experience-specific overlays |
| `app.js` | Camera lifecycle, MediaPipe models, experience router, state, and renderers |
| `gesture-state.js` | Stable gesture-to-effect state machine |
| `cloak-utils.js` | Tested matte and live/captured color-calibration helpers |
| `interaction-utils.js` | Pinch geometry, landmark mapping, hand connections, and orb collision helpers |
| `sign-utils.js` | Static finger-state extraction and Sign Lab pattern classification |
| `pong-utils.js` | Neon Pong ball creation, movement, collision, and game events |
| `*.test.js` | Unit tests for state and reusable geometry/classification helpers |
| `models/` | Local gesture-recognition and person-segmentation model assets |
| `scripts/build.mjs` | Reproducible static deployment build into `dist/` |
| `START VISION SHIFT.command` | Primary macOS launcher; delegates to the local-server bootstrap |
| `assets/visionshift-health.svg` | App-specific marker used to identify a running VisionShift server |
| `.github/workflows/pages.yml` | Test, build, artifact upload, and GitHub Pages deployment |

## Runtime lifecycle

1. A small inline, dependency-free shell initializes the experience navigation before `app.js` is imported.
2. The page loads the local MediaPipe Tasks Vision runtime and hand model, trying GPU and then CPU if necessary. The cloak segmenter degrades independently so other modules still work if it is unavailable.
3. The user explicitly grants webcam access.
4. Each video frame is sent to the gesture recognizer; the selected experience receives the latest result.
5. Reality FX additionally runs person segmentation for cloak compositing.
6. Canvas renders the live camera plus the active visual layer, HUD, drawing, or game.
7. Switching experiences resets only module-specific transient state where necessary; the camera and shared recognizer stay active.

## Local startup and failure recovery

On macOS, **`START VISION SHIFT.command` is the primary launch path**. It delegates to the server bootstrap, installs the MediaPipe browser dependency when it is missing, reuses a running VisionShift instance, or chooses the first available localhost port from `8080` through `8099`. Users should not double-click `index.html`; a `file:` origin cannot satisfy the application's JavaScript-module and camera requirements.

The direct-file page is intentionally a useful recovery screen instead of a silent loading state. It displays the exact launcher name and probes `http://127.0.0.1:8080/` through port `8099` for `assets/visionshift-health.svg`. A successful image probe identifies this project—not merely any process using the port—and redirects to the running app.

Experience selection is wired by the inline shell before the MediaPipe-dependent application module starts. Therefore the six-module navigation continues to work when `app.js`, a model, or its runtime cannot initialize. The camera controls are unavailable in that state, while the visible error panel directs the user to restart with **START VISION SHIFT.command**. This separation makes startup problems diagnosable without leaving the interface frozen on “Loading.”

## Build and deployment

`npm run build` recreates `dist/`, copies every browser module (including `sign-utils.js` and `pong-utils.js`), copies both local models, vendors `@mediapipe/tasks-vision`, and writes `.nojekyll` for GitHub Pages.

The Pages workflow runs `npm ci`, `npm test`, and `npm run build` before uploading `dist/`. The GitHub repository must have **Settings → Pages → Source** set to **GitHub Actions**. Deployed webcam access depends on the HTTPS origin supplied by GitHub Pages.

## Extending VisionShift

1. Add a picker button and matching control panel in `index.html`.
2. Add its text to `EXPERIENCE_META` in `app.js`.
3. Create a renderer such as `renderNewExperience(now)` and route it from `render(now)`.
4. Reuse the shared recognition output instead of starting another recognizer.
5. Put reusable classification, geometry, or physics in a small utility module.
6. Add Node tests and include every browser-imported module in `scripts/build.mjs`.
7. Document controls, privacy impact, model limits, and fallback behavior.

Features that need face, pose, or two-hand context should load the relevant MediaPipe task intentionally and explain the added performance/privacy tradeoffs. Any sign-language feature should be scoped and reviewed as a language and accessibility product—not presented as a general translator from a few static hand poses.
