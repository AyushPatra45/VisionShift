# VisionShift

VisionShift is a browser-based computer-vision playground with **eleven live camera experiences** controlled by hands and expressions. MediaPipe tracks hand landmarks, segments people, and detects facial expressions locally; camera frames are not uploaded by this project.

## Experiences and controls

### 01 · Reality FX

| Control | Result |
| --- | --- |
| Open palm | Activate the background-reference invisibility cloak |
| Closed fist | Split the camera into an RGB glitch |
| Victory sign | Leave multi-frame ghost echoes |
| Point upward | Return to the normal camera |

For the cleanest cloak, keep the camera fixed, step fully out of frame, capture the empty background, and then return. The effect inserts that clean reference only where person segmentation detects you.

### 02 · Air Canvas

| Control | Result |
| --- | --- |
| Raise only the index finger, then move | Draw with the index fingertip; thumb position is unrestricted |
| Lower the index finger | Lift the pen to move without drawing |
| Open palm | Erase beneath the index fingertip |
| Victory sign | Cycle through the ink palette |
| Hold a closed fist | Clear the canvas |

Keep the middle, ring, and pinky fingers folded. The pointing gate tolerates brief tracking dropouts and noisy gesture labels. The brush menu includes **Smooth ink**, **Neon ribbon**, **Rainbow ribbon**, and real distance-spaced **Daisy**, **Star**, **Heart**, **Sparkle**, and **Spider-lily** stamps. Holding still does not pile up stamps; brush size controls their size. Commands require a 250 ms hold after the pen lifts. Undo and redo retain the last 16 edits (including erases and clears). Choose Fine/Medium/Bold, toggle a clean board, or save a PNG without the camera background. ⌘/Ctrl+Z undoes; add Shift to redo. Keep the whole hand visible, use even front lighting, and move deliberately; tracking cannot recover long gaps or motion outside the image.

### 03 · Hand HUD

Show one hand to inspect all 21 tracked landmarks, their connection graph, fingertip positions, handedness, gesture label, and recognition confidence in real time.

### 04 · Orb Game

Aim with the index fingertip and pinch while it overlaps the glowing orb. Consecutive hits build a streak and raise the score. Hold a closed fist to reset the run.

### 05 · Sign Lab

Match a short lesson of five static ASL handshapes: **B**, **I**, **L**, **Y**, and **I love you**. Hold each target steadily until its progress bar completes.

Sign Lab is a small handshape-practice experiment. It is **not** a sign-language translator, interpreter, accessibility tool, or substitute for learning from Deaf signers and qualified teachers. As the [NIDCD overview of American Sign Language](https://www.nidcd.nih.gov/health/american-sign-language) explains, ASL is a complete natural language with its own grammar; motion, orientation, location, facial expression, and two-handed forms are outside this simplified classifier's scope.

### 06 · Neon Pong

Move your hand vertically to control the neon paddle and return the ball. Each hit raises the score and gradually increases the pace; a miss costs a life. Hold a closed fist to restart the game.

### 07 · Personal Sign Reader

The reader lets one person teach the browser their own **static, one-hand poses** and map each pose to a word or short phrase. Type a meaning, hold the pose while choosing **Teach this sign**, then lower the hand. Showing a learned pose steadily adds its label to a transcript; the transcript can be edited, cleared, or spoken aloud. Up to 12 learned signs are stored only in that browser's local storage.

This is a small personalized communication experiment, **not an ASL/ISL translator, interpreter, or accessibility service**. It does not understand motion, two-handed signs, signing location, facial expression, grammar, or continuous signing. A genuine continuous translator is a spatiotemporal language-model problem, as illustrated by the [Sign Language Transformers research](https://openaccess.thecvf.com/content_CVPR_2020/html/Camgoz_Sign_Language_Transformers_Joint_End-to-End_Sign_Language_Recognition_and_Translation_CVPR_2020_paper.html), and requires appropriate language-specific datasets plus evaluation with Deaf signers.

### 08 · Hand Frame

The default **Easy two-hand hold** uses both palm centers: hand distance resizes the floating photo and the angle between the palms rotates it without corner flipping. Pinch once to capture, choose **Live texture**, or load a local PNG/JPEG/WebP. The optional **Four fingertip corners** control keeps the original free-perspective interaction. Local styles include thermal, pencil edges, pixel art, monochrome, poster ink and neon edges. Adapted from [Tuba Khan's HandFrame-AI](https://github.com/tubakhxn/HandFrame-AI), with [license notices](./THIRD_PARTY_NOTICES.md). The original project's FLUX generation is **not connected**: it requires a backend/key and approval to upload captured images. These local effects are not AI-generated paintings.

### 09 · Reaction Memes

Adapted from [Gazi's itsgiving](https://github.com/gazijarin/itsgiving), using its reaction assets and face-relative pose rules with attribution. Nine reactions: gasp, heart hands, covered mouth, hands on head with mouth open, finger on lips, raised hand, nose scrunch, side-eye, and leaving the frame. Meme cards follow the head, animate into view, and show a live reaction label; the leave-frame GIF animates. Calibrate a neutral face for three seconds to personalize the resting baseline. Preview each reaction manually or replace its image/GIF with a local upload (session-only, maximum 12 MB). This is a browser subset, not all fourteen original reactions; body-pose and tongue detectors are not included. It does not install a virtual camera for Zoom/Meet. Face tracking loads on demand, and hand inference also runs for this mode.

### 10 · Study Reminder (experimental)

Choose an eyes-closed delay (1.8, 3, or 5 seconds). Sustained closure of both eyes triggers a full-screen visual warning, a repeating four-tone alarm, and a spoken wake-up message every few seconds until the eyes reopen. **Test voice alarm** verifies sound before a study session. Normal short blinks are ignored, and missing faces reset the timer. **This does not measure attention, studying, fatigue, or health, and must not be used for driving or safety monitoring.** Glasses, head pose, and lighting can cause incorrect results. No monitoring history is saved.

### 11 · Bloom Studio

Choose one of five local, procedural scenes:

| Scene | Hand control |
| --- | --- |
| Flower Wand | Point to plant colorful species; open the palm to scatter them with gravity |
| Red Blooms | Point and move to paint glowing red flowers and growing stems |
| Two-hand Garden | Left-side thumb/index spread grows the structure; right-side spread opens the flower |
| Spider Lilies | Each hand anchors a crimson lily; pinch closes the bud and spreading opens it |
| Particle Storm | One palm repels the field; two nearby palms pull it into a magnetic vortex |

The scene ideas are adapted into Canvas 2D from the supplied reels and informed by [Magical Wands](https://github.com/Axshatt/Magical-Wands), the [spider-lily interaction](https://github.com/cupidbity/spiderlily), and common palm-force particle simulations. No Instagram media is bundled and no external generation API is used.

### Better cloak capture

The capture button gives you three seconds to leave the scene and rejects captures where the model still detects a person. The bundled model's person-confidence mask is used directly, with soft edges; the surrounding camera feed remains live. The hidden region uses the saved reference, so camera movement, shadows, or moving objects behind you cannot be reconstructed perfectly.

## Run locally

Requirements: a modern Chromium-based browser, a webcam, Python 3 for the bundled static server, and a current Node.js/npm installation for dependencies and tests.

### macOS — recommended

Double-click **START VISION SHIFT.command** in the project folder. The launcher installs the browser runtime when needed, reuses an existing VisionShift server or selects an available local port from `8080` through `8099`, and opens the correct page automatically.

If macOS blocks the launcher the first time, right-click **START VISION SHIFT.command**, choose **Open**, and confirm.

### Terminal

```bash
npm install
npm start
```

Open [http://localhost:8080](http://localhost:8080), select an experience, choose **Enable camera**, and allow camera access.

**Do not double-click `index.html`.** A `file:///...` page cannot load the camera modules correctly because browser module and camera security rules require localhost or HTTPS. If it is opened accidentally, VisionShift shows the exact launcher instructions. It also checks local ports `8080`–`8099` for VisionShift's health marker and redirects automatically when the app is already running.

If a model or application module fails to load, the dependency-free page shell and experience navigation remain available. Follow the on-screen restart message, close the stale tab if necessary, and open **START VISION SHIFT.command** again.

## Test and build

```bash
npm test
npm run build
npm run preview
```

`npm run build` creates a self-contained static deployment in `dist/`. It includes the application modules, local MediaPipe models, and the MediaPipe Tasks Vision browser runtime. Preview that exact build at [http://localhost:8081](http://localhost:8081).

Optional browser regression test: install Playwright in your development environment, then run `node scripts/browser-smoke.mjs`. Set `PLAYWRIGHT_PATH` to an installed Playwright module and `CHROME_PATH` to a Chrome executable if needed. The test launches an isolated browser with a synthetic camera, checks actual model startup, all routes, noisy-gesture drawing continuity, undo/redo, PNG export, and mobile overflow. It never uses your physical webcam. Real signing/face accuracy still needs testing with people on target devices.

## Deploy with GitHub Pages

The included GitHub Actions workflow tests, builds, and deploys the site whenever `main` is pushed:

1. Push the project to the repository's `main` branch.
2. Open **Settings → Pages** in GitHub.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push another commit or manually run the Pages workflow from the **Actions** tab.

The deployed site must use HTTPS for webcam access; GitHub Pages provides HTTPS. If a deployment fails, check the workflow log first and verify that GitHub Pages is enabled for the repository.

## Architecture

```text
Webcam frame
    │
    ├── MediaPipe Gesture Recognizer
    │       ├── gesture + confidence
    │       ├── handedness
    │       └── 21 normalized hand landmarks
    │
    ├── MediaPipe Image Segmenter (Reality FX cloak)
    ├── MediaPipe Face Landmarker (loaded on demand)
    │
    └── Experience router
            ├── Reality FX  → segmentation + Canvas compositing
            ├── Air Canvas  → index-up geometry + ribbon/shape-stamp layer
            ├── Hand HUD    → landmark connection renderer
            ├── Orb Game    → fingertip collision + pinch state
            ├── Sign Lab    → finger-state patterns + hold progress
            ├── Neon Pong   → palm-driven paddle + ball physics
            ├── Sign Reader → learned normalized poses + local transcript
            ├── Hand Frame → stable palm transform / four-corner perspective
            ├── Reaction Memes → blendshapes + attributed reaction cards
            ├── Study Reminder → eye closure + repeating voice/alarm
            └── Bloom Studio → procedural flowers + particle physics
```

One recognition result is shared across all experiences, so switching modules does not load another hand model. Rendering and interaction happen with Canvas 2D and vanilla JavaScript modules.

See [PROJECT_GUIDE.md](./PROJECT_GUIDE.md) for the internal state, module logic, and file map.

## Privacy and limitations

- Camera processing happens in the browser. This project's code does not record, store, or upload camera frames.
- Models and runtime assets are served with the static site, so no backend or API key is required.
- Recognition quality depends on lighting, hand visibility, camera angle, motion blur, and device performance.
- The app tracks up to two hands. Gestures that overlap the face/body or leave the frame may be missed.
- The cloak cannot reconstruct what the camera never saw; it uses a previously captured empty-scene reference and works best with a stationary camera and steady lighting.
- Sign Lab recognizes only five simplified, static finger-state patterns and has the important language/accessibility limitations described above.
- Personal Sign Reader recognizes only signer-specific static poses that the current user teaches it; it is not a sign-language translator.
- Webcam access is available only on secure origins (HTTPS) or localhost.

## Technology

- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer/web_js)
- Canvas 2D compositing and game rendering
- Native browser `getUserMedia`
- Vanilla JavaScript modules
- Node's built-in test runner
- [GitHub Actions and GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
