# Benchmarks

Measured with `pnpm gemma:eval` (server-side timings from request receipt) on
2026-10-18, Gemini API, `GEMMA_THINKING_LEVEL=MINIMAL`, one run per variant,
5 s pause between cases. Single runs are noisy; treat differences under ~0.5 s
as inconclusive.

## Test set

Nine synthetic math problems rendered as 768×768 photos-of-paper: right
triangle (Pythagoras), rectangle perimeter, missing angle, circle area, linear
equation, fraction addition, quadratic, rate word problem, slope from two
points. Geometry cases carry hand-labelled corners. Real photos (lighting,
perspective, handwriting) are still needed: add them to `eval/images/` +
`eval/cases.json` (format in `eval/cases.example.json`).

## Variants

| Variant | Valid | Correct | Corner error | First token p50 | First element p50 / p95 | Total p50 |
|---|---|---|---|---|---|---|
| **Full prompt, 768 px, gemma-4-26b-a4b-it (default)** | 9/9 | **9/9** | 0.5 % | 1.8 s | **2.9 s** / 8.0 s | 9.0 s |
| Compact prompt, 768 px, 26B | 9/9 | 9/9 | 0.5 % | 2.0 s | 3.7 s / 4.7 s | 17.8 s (6 elements dropped) |
| Full prompt, 512 px, 26B | 9/9 | 9/9 | 0.5 % | 4.2 s | 5.4 s / 10.4 s | 10.6 s |
| Full prompt, 768 px, gemma-4-31b-it | 1/9 (503 errors) | – | – | 10.2 s | 11.6 s | 18.4 s |

Decision: keep the defaults. The compact prompt made answers longer and less
clean; smaller frames were not faster; the 31B model was mostly unavailable and
far slower.

## Fixes found by the eval

- **LaTeX brace after the closing quote** — Gemma writes `"7\\text{ m"}`. The
  stray `}` used to end the element early and desynchronise the stream parser,
  losing the rest of the answer (2/9 answers empty). The parser now moves the
  brace back into the string when the next token shows the object continues.
  Correct answers went from 7/9 to 9/9.

## Where the time goes

`body ~3 ms · first token ~1.8 s · first element ~2.9 s` (cached frame). Nearly
all of it is model prefill (prompt + image) and the first element's tokens;
upload is off the critical path thanks to early frame upload. The KPI of
< 2.5 s to first overlay is met on some problems (equation 2.3 s, circle 2.2 s)
but not at the median. The scan sweep gives visual feedback immediately.

## Layout (Playwright)

`pnpm e2e`: 18/18 passing — every mock scenario on iPhone 15 (WebKit),
Pixel 7 (Chromium) and iPhone 15 landscape, asserting no overlapping cards or
labels (≤ 10 %), nothing off screen or under the controls, and no horizontal
scrolling in cards.

## On-device

Pending: open `?debug`, run a few questions, tap **copy metrics** and paste the
JSON here for iPhone (iOS 17/18 Safari), a mid-range Android (Chrome) and
desktop browsers.
