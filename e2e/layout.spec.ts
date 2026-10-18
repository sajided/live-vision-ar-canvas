import { expect, test, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const FIXTURE = fileURLToPath(new URL('./fixtures/worksheet.jpg', import.meta.url))
const SCENARIOS = ['geometry', 'algebra', 'steps', 'trace', 'pinpoint'] as const
/** Mock streaming + remaining entry animations, with reduced motion. */
const SETTLE_MS = 6000
/** Text boxes are estimated before render, so allow a sliver of overlap. */
const OVERLAP_TOLERANCE = 0.1

interface Box {
  kind: string
  text: string
  x: number
  y: number
  width: number
  height: number
  scrollWidth: number
  clientWidth: number
}

function overlapRatio(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / Math.min(a.width * a.height, b.width * b.height)
}

async function askAbout(page: Page, scenario: string) {
  await page.route('**/__e2e/worksheet.jpg', (route) => route.fulfill({ path: FIXTURE, contentType: 'image/jpeg' }))
  await page.goto(`/?image=/__e2e/worksheet.jpg&provider=mock&mock=${scenario}`)
  await page.getByRole('button', { name: 'Capture frame' }).click()
  const bar = page.getByTestId('query-bar')
  await expect(bar).toBeVisible()
  await bar.getByRole('textbox').fill('Solve this')
  await bar.getByRole('button', { name: 'Ask' }).click()
  await expect(bar).toBeHidden()
  await page.waitForTimeout(SETTLE_MS)
}

async function overlayBoxes(page: Page): Promise<Box[]> {
  return page.$$eval('[data-overlay]', (els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        kind: el.getAttribute('data-overlay') ?? '',
        text: (el.textContent ?? '').trim().slice(0, 40),
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }
    }),
  )
}

for (const scenario of SCENARIOS) {
  test(`${scenario}: overlays stay readable and on screen`, async ({ page }, testInfo) => {
    await askAbout(page, scenario)
    const boxes = (await overlayBoxes(page)).filter((b) => b.width > 0 && b.height > 0)
    await page.screenshot({ path: `e2e/screenshots/${testInfo.project.name}-${scenario}.png` })
    expect(boxes.length).toBeGreaterThan(0)

    const viewport = page.viewportSize()!
    const controls = await page.getByTestId('control-bar').boundingBox()
    // The control bar's gradient extends upward; its buttons sit in the bottom ~5.5rem.
    const controlsTop = controls ? controls.y + controls.height - 88 : viewport.height

    for (const b of boxes) {
      expect.soft(b.x, `${b.kind} "${b.text}" left edge`).toBeGreaterThanOrEqual(-1)
      expect.soft(b.y, `${b.kind} "${b.text}" top edge`).toBeGreaterThanOrEqual(-1)
      expect.soft(b.x + b.width, `${b.kind} "${b.text}" right edge`).toBeLessThanOrEqual(viewport.width + 1)
      expect.soft(b.y + b.height, `${b.kind} "${b.text}" bottom vs controls`).toBeLessThanOrEqual(controlsTop + 1)
      if (b.kind === 'card') {
        expect.soft(b.scrollWidth, `card "${b.text}" scrolls horizontally`).toBeLessThanOrEqual(b.clientWidth + 1)
      }
    }

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const ratio = overlapRatio(boxes[i], boxes[j])
        expect
          .soft(ratio, `"${boxes[i].text}" (${boxes[i].kind}) overlaps "${boxes[j].text}" (${boxes[j].kind})`)
          .toBeLessThanOrEqual(OVERLAP_TOLERANCE)
      }
    }
  })
}

test('question bar hides after asking and resume clears the answer', async ({ page }) => {
  await askAbout(page, 'geometry')
  await expect(page.getByTestId('query-bar')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Ask a follow-up question' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume live view' }).click()
  await expect(page.locator('[data-overlay]')).toHaveCount(0)
})
