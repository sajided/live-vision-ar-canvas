/** The dock's on-screen box; `side` = docked beside the photo (landscape) rather than above the controls. */
export interface DockBox {
  left: number
  top: number
  width: number
  height: number
  side: boolean
}

export const NO_DOCK: DockBox = { left: 0, top: 0, width: 0, height: 0, side: false }
