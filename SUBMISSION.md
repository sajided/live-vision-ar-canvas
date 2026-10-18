# StepProof — Hackathon Submission

## Tagline

**Point your phone at a math problem and a tutor draws the solution onto it, out loud.**

StepProof is a mobile web app that turns the camera into a math tutor. You aim it at a textbook, worksheet or whiteboard and ask a question by voice or text. Gemma reads the photo and answers as structured drawing instructions, not a block of text. The app then traces the figure in front of you with a pen and labels its corners and sides. It works through the solution as numbered steps with real formulas, while an ElevenLabs voice explains each step as it appears.

## Inspiration

When a student gets stuck on a geometry problem, the hard part is usually seeing it, not the arithmetic. Which side is the hypotenuse? Where does that angle sit? A good tutor points at the page, sketches on it and talks you through it.

AI homework help mostly gives a wall of text about a figure you then have to map back onto the page yourself. We wanted the answer to land on the problem itself: drawn where the student is looking and explained out loud one step at a time. The same idea works on a whiteboard in class or a worksheet at the kitchen table.

## What it does

It opens straight into a full-screen camera, with no app install. A session goes like this:

1. **Point and ask.** Tap the shutter and type a question, or hold the mic and just say it ("find x", "explain this"). The frame freezes on release. The app keeps the sharpest of a short burst of frames, so a shaky hand doesn't blur the photo.
2. **Gemma reads the problem.** The frozen frame goes to Gemma with the question. A cyan scan sweep shows the photo is being read.
3. **The figure is traced in place.** A glowing pen draws the triangle, circle or angle edge by edge on top of the photo:
    - every edge in its own colour, with lettered corners (A, B, C)
    - a right-angle square and angle arcs marked where they belong
    - known and unknown lengths ("a = 3", "c = ?") labelled beside each side
4. **The tutor talks you through it.** Each step appears while the ElevenLabs voice explains it, for example "3 squared is 9, 4 squared is 16, and together that makes 25". The next step waits until both the drawing and the sentence are done, and subtitles show every line.
5. **Steps you can page through.** Numbered steps with formulas rendered in KaTeX collect in a step dock above the controls, or beside the photo in landscape. You can swipe back to any step, and a pulsing ring marks the part of the photo the current step is about.
6. **Mini whiteboard.** When a picture helps but isn't in the photo, such as a parabola and its roots, the tutor draws it on a small whiteboard card.
7. **Follow up.** Ask another question about the same frozen frame, clear the drawings, or resume the live camera.

It is math only: arithmetic, algebra, geometry, trigonometry, word problems. A conceptual question like "explain Pythagoras" still gets a drawn lesson even with nothing relevant in view.

## How we built it

```text
PHONE BROWSER (React)          OUR SERVER (Hono)              AI SERVICES

Camera capture  ── frame ────► Frame cache
(sharpest of a burst)          (/api/frames, 2 min)
                                     │ frame id
                                     ▼
Ask (voice / text) ─ question ► Answer stream ◄── frame / JSON ──► Gemma
                               (parse, repair, Zod)                (gemma-4-26b-a4b-it)
                                     │
Tutor sequencer ◄───── SSE ──────────┘
(reveal while speaking) ◄── line / audio ──► Speech proxy ◄── text / MP3 ──► ElevenLabs
        │                                    (/api/speech, cached)          (eleven_flash_v2_5)
        ▼ reveal
Overlay renderer
(pen tracing, step dock)
```

The frame uploads the moment it's frozen. Gemma's answer streams back as validated elements, and the tutor reveals each one while ElevenLabs speaks its line. Both API keys stay on our server.

- **Camera and capture (React + TypeScript).** A full-screen rear camera via `getUserMedia`. The shutter scores a burst of frames for sharpness (Laplacian variance) and keeps the best. It crops exactly what's on screen and letterboxes it into a 768×768 frame, encoded as WebP or JPEG in under 100 ms. A still-image mode replaces the camera for desktop testing and automated tests.
- **Gemma as a structured tutor.** `gemma-4-26b-a4b-it` runs through the Gemini API with a math-tutor system prompt. JSON output is set with `responseMimeType`; Gemma rejected a response schema, so Zod does the validation. Thinking is set to minimal, which roughly halved time to first token in our tests. The model answers in a strict vocabulary of nine element types: `Polygon`, `Circle`, `Angle`, `MathLabel`, `ConnectorLine`, `TargetBeacon`, `Formula`, `InfoCard` and `Diagram`. Each carries a `say` line for the voice.
- **Streaming server (Node + Hono).** It pulls each complete element out of the token stream, repairs LaTeX, converts the 0–1000 grid to 0–100 and validates with Zod, then sends it as Server-Sent Events. It also:
    - detects answers that were cut off
    - retries a busy or failed model call once, before anything has streamed
    - rate-limits each client
    - keeps frames in memory only, for 2 minutes
- **Voice (ElevenLabs).** `GET /api/speech` forwards to ElevenLabs streaming text-to-speech (`eleven_flash_v2_5`) with an in-memory audio cache. The browser prefetches the next lines so each starts on cue. Without a key it falls back to the browser's speech synthesis, and without any voice it paces lines by reading time.
- **Rendering.** One registry maps each element type to a pre-built component, and the browser re-checks every element with the same Zod schema. Rendering details:
    - SVG paths draw on with a pen tip that moves at constant speed
    - formulas render in KaTeX, which loads on demand
    - a collision-aware layout keeps labels and cards off lines, dots and each other
    - the step dock holds numbered steps
    - reduced-motion settings are respected

## Challenges we ran into

- **Gemma ignored our coordinate grid.** We asked for 0–100 percentages and got values like 143 and 543. Checked against the photo, they were exact on a 0–1000 grid, which is Gemma's native way of locating things. We switched the prompt to 0–1000 and convert on the server, so the app still uses 0–100.
- **The letterboxed square.** The model sees a square frame with black bars, while the phone shows a portrait crop. We send only the visible crop and record where the photo sits inside the square. The prompt tells Gemma where the bars are, and every point is mapped back to the screen, even after the phone rotates while frozen.
- **LaTeX inside JSON breaks in creative ways.** Common failures we saw:
    - single backslashes: `\text` arrives as a tab character followed by "ext", `\frac` as a form feed followed by "rac"
    - invalid escapes like `\sqrt`
    - unclosed braces
    - the subtlest: Gemma writes `"7\\text{ m"}`, closing the string before the brace. That stray `}` ended the element early and silently lost the rest of the answer.

  Our streaming parser now looks ahead and moves the brace back inside the string. That one fix took eval correctness from 7/9 to 9/9.
- **Streaming partial JSON.** To draw the first element in under 3 s we can't wait for the full answer. A character-level parser extracts each complete element as it streams, survives chunk boundaries mid-escape and ignores code fences. Each element is validated with Zod on the server and again in the browser.
- **Overlap on a phone screen.** Floating step cards over a traced figure were unreadable, and our Playwright tests caught overlaps at phone sizes. The fix had two parts:
    - a collision-aware layout for labels and cards that avoids lines, dots, other labels and the controls
    - moving numbered steps into a dock, so the figure stays clear
- **Mobile browser quirks.** iOS needs a user gesture before any audio, and its on-screen keyboard doesn't resize the page. Safari can't encode WebP. React StrictMode's double effects silently dropped our first step in development. Each needed its own workaround.

## Results

On our 9-problem benchmark, Gemma's answers were 9/9 valid and 9/9 correct, with traced corners within 0.5% of the true figure. The first overlay arrives at a median of 2.9 s, just over our 2.5 s target.

| Measure | Result | Target |
| --- | --- | --- |
| Valid answers (schema-checked) | 9/9 (100%) | > 98% |
| Correct final answer | 9/9 | – |
| Traced-corner error | 0.5% of image width (mean) | – |
| First token from Gemma (median) | 1.8 s | – |
| First overlay on screen (median / 95th percentile) | 2.9 s / 8.0 s | < 2.5 s |
| Tutor voice, first audio / cached replay | 2.0 s / 3 ms | – |
| Automated tests | 139 unit + 21 Playwright end-to-end, all passing | – |
| First-load JavaScript (gzipped) | 165 KB, plus 78 KB of KaTeX loaded on demand | – |

The benchmark covers Pythagoras, perimeter, a missing angle, circle area, a linear equation, adding fractions, a quadratic, a rate word problem and slope. It uses clean synthetic photos; real camera photos with glare and handwriting are next.

We also tested a shorter prompt, 512 px frames and the larger `gemma-4-31b-it` model. None was faster or more accurate, so we kept the defaults. The end-to-end tests run every scenario on iPhone, Pixel and landscape layouts and check that nothing overlaps or runs off screen.

## Accomplishments and what we learned

We're proudest that the answer happens on the page. A tutor's pen traces the student's own triangle, and a voice says why each step follows. It never turns into a chat transcript.

- **Structured output beats free text.** Gemma never writes HTML or code for the screen. It fills a small, strict JSON vocabulary of nine element types, and each one maps to a pre-built component. That makes the drawing safe: nothing the model writes is run as code. It is also testable and consistent across every answer.
- **Measure, don't guess.** An eval harness that scores answer correctness and corner accuracy gave us honest numbers. It also caught the LaTeX bug that two of nine answers were silently hitting.
- **The model's native habits are a feature.** Gemma's 0–1000 grid was accurate from the start. Working with it, instead of forcing our 0–100 scale, was the fix.
- **Pacing matters as much as content.** Revealing elements as the tutor speaks, instead of all at once, made the same answer feel like a lesson.
- **Test on the real screen.** Playwright at iPhone and Pixel sizes found layout problems that unit tests and desktop testing never showed.

## What's next

- **Real-world benchmark.** Grow the eval from 9 synthetic problems to real phone photos: glare, perspective, handwriting, printed worksheets. Tune the prompt against them.
- **Get the first overlay under 2.5 s at the median.** Ideas include having the model emit a short first element and streaming audio for the first line sooner.
- **Spatial anchoring.** Keep drawings locked to the paper when the phone moves, using lightweight feature tracking (WebXR or OpenCV.js), instead of freezing the frame.
- **Interactive tutoring.** Let the student answer a step before it's revealed ("what do you think 3 squared is?"). Track where they get stuck.
- **On-device benchmarks and offline mode.** Measure on mid-range Android and iPhone, and explore a small on-device model through WebGPU for when connectivity drops.
- **More languages.** Gemma and ElevenLabs both support many languages, so the tutor could teach in the student's own.

## Built with and links

**Code:** [github.com/sajided/live-vision-ar-canvas](https://github.com/sajided/live-vision-ar-canvas), MIT license.

| Area | Technologies |
| --- | --- |
| AI | Gemma (`gemma-4-26b-a4b-it`) via the Gemini API (`@google/genai`), ElevenLabs text-to-speech (`eleven_flash_v2_5`) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Motion, KaTeX, Lucide icons |
| Browser APIs | getUserMedia camera, Web Speech API (voice input and fallback voice), WebAudio, Vibration, Canvas, visualViewport |
| Backend | Node.js, Hono, Server-Sent Events |
| Validation | Zod (one shared schema on server and client) |
| Testing | Vitest (139 unit tests), Playwright (Chromium + WebKit at phone sizes), custom Gemma eval harness |

**Run it locally**

```bash
pnpm install
cp .env.example .env   # add GEMINI_API_KEY and, optionally, ELEVENLABS_API_KEY
pnpm dev               # https://localhost:5173 (on a phone: https://<your-lan-ip>:5173)
```

To try it without a camera or API keys, open `/?image=<url>&provider=mock&mock=geometry`. Other mock scenarios are `algebra`, `steps`, `trace` and `pinpoint`. Add `?debug` for live timings.
