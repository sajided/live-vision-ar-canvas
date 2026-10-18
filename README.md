# Live Vision AR Canvas

Mobile-first AR **math tutor** (see `product_requirement_document.md`). Point the camera at a math problem, ask by voice (hold the mic) or by typing after the shutter, and Gemma's worked solution streams in over the photo: geometry traced on the figure (polygons, circles, angle marks, length labels), step-by-step formulas (KaTeX), and mini whiteboard diagrams for things not in view.

## Develop

```sh
pnpm install
cp .env.example .env   # add GEMINI_API_KEY (server-only)
pnpm dev               # web https://localhost:5173 (+ https://<lan-ip>:5173) and API :8787
pnpm test              # unit tests (Vitest)
pnpm e2e               # layout tests in Chromium + WebKit at phone sizes (Playwright, no camera/API needed)
pnpm typecheck && pnpm lint && pnpm build
```

URL flags: `?image=<url>` replaces the camera with a still image (desktop testing, e2e); `?debug` shows a HUD (capture timing, provider/mock switch, time to first overlay, validation counts); `?provider=mock&mock=geometry` (or `algebra`, `steps`, …) uses canned responses instead of Gemma.

## Gemma

- `server/` (Hono) receives the frame at `POST /api/annotate`, streams it to Gemma via the Gemini API, extracts elements from the streamed JSON as they complete, validates them with the shared Zod schema and sends them to the client as SSE `element` / `done` / `error` events. The client validates again.
- Gemma localizes on a 0–1000 grid; the prompt asks for that and the server rescales to the 0–100 contract (photo and diagram coordinates alike).
- LaTeX from the model is repaired (single-backslash commands, unbalanced braces) and checked with KaTeX on the server; elements that still fail are dropped.
- Findings (gemma-4-26b-a4b-it, Oct 2026): `responseMimeType: application/json` works but `responseJsonSchema` returns 400; `thinkingLevel: MINIMAL` is accepted and cuts time to first token; `thinkingBudget` is rejected.
- `pnpm gemma:probe <image> [question]` checks streaming and JSON mode live.
- `pnpm gemma:eval [eval/cases.json]` runs labelled photos (see `eval/cases.example.json`) and reports validity, latency percentiles and beacon hit rate. Use it when tuning `server/prompt.ts`.

Phones must use the `https://<lan-ip>` URL and accept the certificate, because camera access requires a secure origin.

## Coordinates

`captureFrame` encodes only what the viewfinder shows (the `object-fit: cover` crop), letterboxed into a 768×768 square. `frame.contentRect` records where that content sits inside the square (0–100). Use `imageToViewport` / `viewportToImage` from `src/camera/geometry.ts` to convert model coordinates to screen percentages.

## Phase 4: speed, reliability, feedback

- **Early upload**: the frame is uploaded to `POST /api/frames` the moment it's frozen (kept in server memory for 2 minutes, never on disk); asking sends only text plus the `frameId`. Expired ids fall back to an inline upload.
- **Timing**: the server logs body / first token / first element / total per request; the HUD shows client and server timings and can copy the last 10 runs as JSON for benchmarking.
- **Reliability**: cut-off answers are detected (unclosed JSON or `MAX_TOKENS`) and retried when too little arrived; upstream 429/5xx errors are retried once before any output and otherwise shown as a clear message; offline is detected; `/api/annotate` and `/api/frames` are rate limited per client.
- **LaTeX in JSON**: Gemma often emits `"7\\text{ m"}` (quote before the brace); the stream parser moves the brace back inside the string when the next token shows another field follows.
- **Freeze stabilization**: the shutter freezes the sharpest of a ~130 ms burst (Laplacian variance) and warns about blurry/dark frames with a Retake action.
- **Feedback**: synthesized WebAudio cues (shutter, mic, first overlay, steps, error) with a mute toggle; `navigator.vibrate` haptics on Android (iOS Safari has no vibration API); shutter flash; scan sweep while waiting.
- **Step dock**: numbered steps and diagrams are read one at a time in a dock above the controls (beside the photo in landscape) with paging and swipe; a pulsing ring marks where the current step applies, so the traced figure stays uncovered.
- **Accessibility**: `prefers-reduced-motion` skips pen pacing and transform animations.
- **Bundle**: KaTeX loads on demand (prefetched at capture), keeping the first load at ~160 KB gzipped.
- **Variants**: `PROMPT_VARIANT=full|compact`, `GEMMA_MODEL`, frame size — compare with `pnpm gemma:eval <cases.json> --images <dir> --pause 5000`; results in `docs/benchmarks.md`.

## License

[MIT](LICENSE)
