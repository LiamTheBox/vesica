// Frames the bladder inside the HUD's stage area instead of the whole screen.
//
// The canvas fills the screen, but HUD panels cover its top and bottom (and, on a
// landscape phone, its right side). We pick a camera distance at which the organ's
// extent fits the stage, and a projection offset (camera.setViewOffset) that moves the
// image centre from the screen centre to the stage centre.

// Half-extent of the scene worth framing, in world units, about FRAME_CENTER_Y: the
// bladder at its fullest in the sandbox, from the top of its dome down to the end of the
// urethra below it. An overfilled arcade bladder grows past this; StageFit backs the camera
// off by as much (overfillGrowth).
export const ORGAN_HALF_HEIGHT = 4.6
export const ORGAN_HALF_WIDTH = 3.4
export const FRAME_CENTER_Y = -1.15
// Side rails sit over the stage's left and right edges.
export const RAIL_ALLOWANCE_PX = 56

export function stageFit({ fov, viewport, stage, minDistance = 7, maxDistance = 40 }) {
  const tanHalf = Math.tan(((fov / 2) * Math.PI) / 180)
  const aspect = viewport.width / viewport.height
  const usableWidth = Math.max(1, stage.width - 2 * RAIL_ALLOWANCE_PX)

  // At distance d the screen shows ±d·tanHalf vertically; the stage gets a share of it.
  const fitHeight = ORGAN_HALF_HEIGHT / (tanHalf * (stage.height / viewport.height))
  const fitWidth = ORGAN_HALF_WIDTH / (tanHalf * aspect * (usableWidth / viewport.width))
  const distance = Math.min(maxDistance, Math.max(minDistance, fitHeight, fitWidth))

  const offsetX = -(stage.x + stage.width / 2 - viewport.width / 2)
  const offsetY = -(stage.y + stage.height / 2 - viewport.height / 2)
  return { distance, offsetX, offsetY }
}
