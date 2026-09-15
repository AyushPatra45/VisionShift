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

`PointingGate` uses finger-extension geometry: index extended, middle/ring/pinky folded, thumb unrestricted. A 70 ms release grace filters noisy poses; missing tracking is tolerated for 150 ms. `smoothCanvasPoint` applies motion-adaptive smoothing, and midpoint quadratic curves join samples on a persistent offscreen canvas. Smooth ink, neon and rainbow use the same connected curves; colored glow is applied only for the luminous ribbons. Daisy, star, heart, sparkle and spider-lily brushes draw real procedural shapes at distance-based intervals. All brushes share edit history and mirrored export. An open palm erases, victory cycles colors, and a held fist clears.

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

### 07 · Personal Sign Reader

The reader is a user-trained static-pose recognizer. `sign-reader-utils.js` translates each hand to a wrist-relative coordinate system, normalizes its size by palm width and in-plane rotation by the wrist-to-middle-finger axis, and averages 24 training samples into one 63-value pose prototype. Live poses are compared with the locally saved prototypes using root-mean-square distance, including a mirrored comparison so either hand can reproduce a learned pose. A match must remain stable before its user-supplied label is appended to the transcript, and the hand must be lowered before the same label can repeat.

The learned library is capped at 12 entries and stored in browser `localStorage`; camera frames and landmarks are not uploaded. Speech uses the browser's built-in speech synthesis when available.

This feature is intentionally named **Personal Sign Reader**, not sign-language translator. It recognizes only signer-specific static poses deliberately taught to it. It cannot interpret ASL, ISL, another natural sign language, motion, two-hand relationships, facial/non-manual markers, grammar, or continuous discourse. Building a real translator requires language-specific sequence data, temporal models, signer-diverse evaluation, and collaboration with Deaf communities.

### 08–10 · Camera studios

`camera-studio.js` loads face tracking and the study timer. `reel-renderer.js` implements the original-repository-inspired photo panel and reaction overlays. Hand Frame defaults to a constrained, edge-clamped rectangle controlled by two palm centers: separation controls size and palm-to-palm angle controls rotation. An optional four-fingertip mode forms a convex quadrilateral; a homography and subdivided Canvas triangles project the captured texture. Pinching captures a center crop, and users can instead load a local photo or select a live texture. Local CPU pixel styles are explicitly distinguished from unconnected FLUX generation.

Reaction Memes runs hand and face tracking together, uses face-relative pose rules, a steady-hold gate and three-second neutral baseline, and displays original attributed assets as animated cards with a live label. A DOM overlay preserves GIF animation and avoids double-rendering the same opaque card. Nine reactions are supported, not all fourteen desktop reactions.

Bilateral eye closure drives the experimental Study Reminder. When its selected delay elapses, the renderer repeats a four-note alarm roughly every 2.3 seconds and a spoken warning roughly every 6.2 seconds until the eyes reopen. The audio context is unlocked from the user's camera-start or test-button click, satisfying browser autoplay restrictions. A full-screen red warning remains available if audio is disabled.

### 11 · Bloom Studio

`bloom-studio.js` provides five selectable scenes on the existing shared hand feed. Flower Wand and Red Blooms use a geometry-based pointing pose, movement spacing, capped object pools and an open-palm scatter latch. Two-hand Garden sorts visible hands left-to-right and normalizes each thumb/index spread: the left-side spread controls procedural stem growth while the right-side spread controls staged petal opening. Spider Lilies anchor curved petals and stamens to up to two fingertips. Particle Storm runs a bounded spring/velocity field; one palm repels particles and two nearby palms attract and swirl them. All scenes use Canvas 2D and require no backend.

`studio-utils.js` contains independently tested hold timers, pointing detection, bounded drawing history, hand-frame geometry, and eye-closure state. Air Canvas gives index-up geometry priority over canned gesture labels. Command holds, adaptive smoothing, brief tracking-loss grace, and long-jump guards reduce false stroke breaks; Undo/Redo include erase/clear edits. Export mirrors the offscreen ink to match the displayed handwriting.

### Reference scope and credits

The requested Instagram references were inspected in-browser: [meeting effects by Gazi Jarin](https://www.instagram.com/reel/Dc_ZvBcO9XM/), [study reminder by Swastik Biswas](https://www.instagram.com/reel/DcWrXcHzP3L/), [invisibility](https://www.instagram.com/reel/DZ4zT_XPCJw/), [HandFrame by tuba.captures](https://www.instagram.com/reel/DbphY3JpgUN/), [red blooms](https://www.instagram.com/p/DaNwDTqCirt/), [flower wand](https://www.instagram.com/p/DbSGgdiN6_u/), [particle storm](https://www.instagram.com/p/Dcfb4AOvJd2/), [two-hand flower growth](https://www.instagram.com/p/DaU276SzDHs/), [a static sign classifier](https://www.instagram.com/p/DbAjdehvpn0/), [spider lilies](https://www.instagram.com/p/DbD221EJvK-/), and [mirror writing](https://www.instagram.com/p/DaFyq0Vg9U9/). These additions are browser adaptations inspired by the visible concepts, not copies of the creators' Instagram media or a promise of pixel-identical results. No Instagram media is bundled.

Bloom interactions were cross-checked against the public documentation for [Magical Wands](https://github.com/Axshatt/Magical-Wands), [cupidbity/spiderlily](https://github.com/cupidbity/spiderlily), and a [hand-controlled particle system](https://github.com/chaitanya4545-ai/hand-controlled-particle-system). The local implementation is original; these projects are credited for their control patterns and design inspiration.

Face tracking follows Google's [MediaPipe Web guide](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js). The version-1 model is bundled from [Google's official model storage](https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task). The [Selfie Segmentation model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Selfie%20Segmentation.pdf) specifies a person-probability mask. The application no longer guesses polarity per frame. Background capture has a countdown and checks for person pixels before saving.

API and continuous sign-language translation work remains paused; the existing practice and personal-pose tools are unchanged.

## File map

| File | Responsibility |
| --- | --- |
| `index.html` | Product layout, eleven-experience picker, controls, status, and explanatory copy |
| `styles.css` | Responsive visual system and experience-specific overlays |
| `app.js` | Camera lifecycle, MediaPipe models, experience router, state, and renderers |
| `gesture-state.js` | Stable gesture-to-effect state machine |
| `cloak-utils.js` | Tested matte and live/captured color-calibration helpers |
| `interaction-utils.js` | Pinch hysteresis, adaptive point smoothing, landmark mapping, hand connections, and orb collision helpers |
| `sign-utils.js` | Static finger-state extraction and Sign Lab pattern classification |
| `sign-reader-utils.js` | Personal pose normalization, averaging, mirroring, persistence validation, and matching |
| `pong-utils.js` | Neon Pong ball creation, movement, collision, and game events |
| `camera-studio.js` | On-demand face model, face effects, study reminder, two-hand frame |
| `reel-renderer.js` | Reaction cards and the easy/perspective floating photo renderer |
| `reel-utils.js` | Reaction rules, two-hand frame geometry, and homography projection |
| `bloom-studio.js` | Procedural flower scenes and hand-force particle simulation |
| `studio-utils.js` | Command holds, drawing history, frame geometry, eye-closure timer |
| `scripts/browser-smoke.mjs` | Isolated browser checks using a synthetic camera |
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

Experience selection is wired by the inline shell before the MediaPipe-dependent application module starts. Therefore the seven-module navigation continues to work when `app.js`, a model, or its runtime cannot initialize. The camera controls are unavailable in that state, while the visible error panel directs the user to restart with **START VISION SHIFT.command**. This separation makes startup problems diagnosable without leaving the interface frozen on “Loading.”

## Build and deployment

`npm run build` recreates `dist/`, copies every browser module (including `sign-utils.js`, `sign-reader-utils.js`, and `pong-utils.js`), copies both local models, vendors `@mediapipe/tasks-vision`, and writes `.nojekyll` for GitHub Pages.

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
