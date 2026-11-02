// How to lay `count` square tiles out in the room there is, a `gap` apart: the biggest that
// all fit, in as balanced a block as can be, with no gaps in the last row if possible. Below
// LEAST_TILE they'd be too small to read or to hit, so on a very small screen they stay that
// big, and what's left over scrolls.
export const MOST_TILE = 116
export const LEAST_TILE = 52

export function fitTiles(count, width, height, gap) {
  let best = null
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    const size = Math.min(MOST_TILE, (width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows)
    const empty = rows * columns - count
    const bigger = !best || size > best.size + 0.5
    const asBig = best && Math.abs(size - best.size) <= 0.5
    if (bigger || (asBig && empty < best.empty)) best = { columns, rows, size, empty }
  }
  if (best.size >= LEAST_TILE) return { columns: best.columns, size: Math.floor(best.size) }
  return { columns: Math.max(1, Math.floor((width + gap) / (LEAST_TILE + gap))), size: LEAST_TILE }
}
