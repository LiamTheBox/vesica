import {
  BALANCE_FALLEN, CLENCH_RING_Y, DODGE_REACH, DODGE_Y, HOLD_BAND, MATCH, RELEASE, RELEASE_ON, SEAL_RADIUS, SQUEEZE_BOTTOM,
  SQUEEZE_TOP,
} from '../../sim/micro/games'
import { t } from '../../i18n'

// Draws a microgames run (M8) on a 2D canvas: the game's scene in a square play area, its
// verb, the fuse and the result. Abstract shapes only: the ring is the sphincter, amber is
// urine, red is a spike. The logic is in src/sim/micro/.

const FONT = "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif"
const C = {
  ink: '#f1f5f9',
  faint: 'rgba(148, 163, 184, 0.22)',
  ring: '#fb7185',
  deep: '#9f1239',
  good: '#34d399',
  bad: '#f43f5e',
  amber: '#fbbf24',
  cyan: '#22d3ee',
  boss: '#e879f9',
}
const FUSE_ROOM = 26 // px under the play area for the fuse
const SHADE = 0.86 // the backdrop while a game is on

// The play area: the biggest square that fits, with the fuse's room below it.
export function playArea(width, height) {
  const size = Math.max(1, Math.min(width * 0.94, (height - FUSE_ROOM) * 0.94))
  return { left: (width - size) / 2, top: (height - FUSE_ROOM - size) / 2, size }
}

// From the unit square to pixels.
const view = ({ left, top, size }) => ({ X: (u) => left + u * size, Y: (v) => top + v * size, S: (d) => d * size })

function circle(ctx, x, y, r) {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
}

function text(ctx, value, x, y, size, color, outline = 'rgba(2, 6, 23, 0.9)') {
  ctx.font = `800 ${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.16
  ctx.strokeStyle = outline
  ctx.strokeText(value, x, y)
  ctx.fillStyle = color
  ctx.fillText(value, x, y)
}

// --- Scenes ------------------------------------------------------------------

function drawClench(ctx, g, V, run) {
  const top = 0.05
  const ring = CLENCH_RING_Y
  ctx.strokeStyle = C.faint
  ctx.lineWidth = V.S(0.012)
  ctx.setLineDash([V.S(0.025), V.S(0.025)])
  ctx.beginPath()
  ctx.moveTo(V.X(0.5), V.Y(top))
  ctx.lineTo(V.X(0.5), V.Y(ring))
  ctx.stroke()
  ctx.setLineDash([])

  // The ring lights up while a pulse is in it, and tightens while pressed.
  const live = g.pulses.some((p) => !p.caught && Math.abs(g.t - p.arrive) <= g.window)
  const r = 0.13 * (run.input.down ? 0.78 : 1)
  ctx.lineWidth = V.S(0.05)
  ctx.strokeStyle = live ? C.amber : C.ring
  circle(ctx, V.X(0.5), V.Y(ring), V.S(r))
  ctx.stroke()

  const speed = (ring - top) / g.travel
  for (const p of g.pulses) {
    if (p.caught) {
      const age = g.t - p.caughtAt
      if (age < 0.35) {
        ctx.strokeStyle = `rgba(34, 211, 238, ${1 - age / 0.35})`
        ctx.lineWidth = V.S(0.02)
        circle(ctx, V.X(0.5), V.Y(ring), V.S(0.13 + age * 0.4))
        ctx.stroke()
      }
      continue
    }
    const y = ring - (p.arrive - g.t) * speed
    if (y < top - 0.04) continue
    ctx.fillStyle = C.amber
    ctx.shadowColor = C.amber
    ctx.shadowBlur = V.S(0.05)
    circle(ctx, V.X(0.5), V.Y(y), V.S(0.045))
    ctx.fill()
    ctx.shadowBlur = 0
  }
}

function drawPush(ctx, g, V) {
  const x0 = 0.38, x1 = 0.62, y0 = 0.08, y1 = 0.92
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.fillRect(V.X(x0), V.Y(y0), V.S(x1 - x0), V.S(y1 - y0))
  const fillTop = y1 - (y1 - y0) * Math.min(1, g.level)
  const gradient = ctx.createLinearGradient(0, V.Y(y1), 0, V.Y(y0))
  gradient.addColorStop(0, C.amber)
  gradient.addColorStop(0.7, '#fb923c')
  gradient.addColorStop(1, C.bad)
  ctx.fillStyle = gradient
  ctx.fillRect(V.X(x0), V.Y(fillTop), V.S(x1 - x0), V.Y(y1) - V.Y(fillTop))
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.014)
  ctx.strokeRect(V.X(x0), V.Y(y0), V.S(x1 - x0), V.S(y1 - y0))
  // The top it mustn't reach.
  ctx.strokeStyle = C.bad
  ctx.lineWidth = V.S(0.02)
  ctx.setLineDash([V.S(0.03), V.S(0.02)])
  ctx.beginPath()
  ctx.moveTo(V.X(x0 - 0.08), V.Y(y0))
  ctx.lineTo(V.X(x1 + 0.08), V.Y(y0))
  ctx.stroke()
  ctx.setLineDash([])
  // Chevrons pressing down on it.
  ctx.strokeStyle = C.ink
  ctx.lineWidth = V.S(0.018)
  for (let i = 0; i < 2; i++) {
    const y = fillTop - 0.06 - i * 0.05
    if (y < y0) break
    ctx.beginPath()
    ctx.moveTo(V.X(0.44), V.Y(y - 0.025))
    ctx.lineTo(V.X(0.5), V.Y(y + 0.01))
    ctx.lineTo(V.X(0.56), V.Y(y - 0.025))
    ctx.stroke()
  }
}

function drawSeal(ctx, g, V) {
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.07)
  circle(ctx, V.X(0.5), V.Y(0.5), V.S(SEAL_RADIUS))
  ctx.stroke()
  for (const crack of g.cracks) {
    if (g.t < crack.at) continue
    if (crack.sealed) {
      ctx.fillStyle = C.cyan
      circle(ctx, V.X(crack.x), V.Y(crack.y), V.S(0.03))
      ctx.fill()
      continue
    }
    const p = Math.min(1, (g.t - crack.at) / g.open)
    const color = p > 0.66 ? C.bad : C.amber
    // A target ring shrinking in on it, and jagged lines splitting the wall.
    ctx.strokeStyle = color
    ctx.lineWidth = V.S(0.012)
    circle(ctx, V.X(crack.x), V.Y(crack.y), V.S(0.1 * (1 - p) + 0.03))
    ctx.stroke()
    const out = Math.atan2(crack.y - 0.5, crack.x - 0.5)
    ctx.lineWidth = V.S(0.016 + 0.02 * p)
    ctx.beginPath()
    for (const side of [-1, 1]) {
      const along = out + side * Math.PI / 2
      ctx.moveTo(V.X(crack.x), V.Y(crack.y))
      ctx.lineTo(V.X(crack.x + Math.cos(along) * 0.03 * p + Math.cos(out) * 0.02), V.Y(crack.y + Math.sin(along) * 0.03 * p + Math.sin(out) * 0.02))
      ctx.lineTo(V.X(crack.x + Math.cos(along) * 0.07 * p), V.Y(crack.y + Math.sin(along) * 0.07 * p))
    }
    ctx.stroke()
  }
}

function drawBalance(ctx, g, V) {
  const pivot = { x: 0.5, y: 0.9 }
  const reach = 0.5
  // Where it falls.
  ctx.fillStyle = 'rgba(244, 63, 94, 0.12)'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(V.X(pivot.x), V.Y(pivot.y))
    ctx.arc(V.X(pivot.x), V.Y(pivot.y), V.S(reach + 0.2), -Math.PI / 2 + side * BALANCE_FALLEN, -Math.PI / 2 + side * Math.PI / 2, side < 0)
    ctx.closePath()
    ctx.fill()
  }
  const head = { x: pivot.x + Math.sin(g.angle) * reach, y: pivot.y - Math.cos(g.angle) * reach }
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.04)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(V.X(pivot.x), V.Y(pivot.y))
  ctx.lineTo(V.X(head.x), V.Y(head.y))
  ctx.stroke()
  ctx.lineCap = 'butt'
  // The bladder: amber sloshing level inside, lagging the tilt.
  const r = 0.17
  ctx.save()
  circle(ctx, V.X(head.x), V.Y(head.y), V.S(r))
  ctx.fillStyle = C.deep
  ctx.fill()
  ctx.clip()
  ctx.translate(V.X(head.x), V.Y(head.y))
  ctx.rotate(-g.spin * 0.08)
  ctx.fillStyle = C.amber
  ctx.fillRect(-V.S(r), -V.S(r * 0.15), V.S(2 * r), V.S(2 * r))
  ctx.restore()
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.025)
  circle(ctx, V.X(head.x), V.Y(head.y), V.S(r))
  ctx.stroke()
  ctx.fillStyle = C.faint
  ctx.beginPath()
  ctx.moveTo(V.X(pivot.x - 0.06), V.Y(pivot.y + 0.06))
  ctx.lineTo(V.X(pivot.x + 0.06), V.Y(pivot.y + 0.06))
  ctx.lineTo(V.X(pivot.x), V.Y(pivot.y))
  ctx.fill()
  // A shove just landed: a flash on the side it came from.
  const last = g.shoves[g.next - 1]
  if (last && g.t - last.t < 0.25) {
    const side = last.kick > 0 ? -1 : 1
    ctx.strokeStyle = `rgba(244, 63, 94, ${1 - (g.t - last.t) / 0.25})`
    ctx.lineWidth = V.S(0.03)
    ctx.beginPath()
    ctx.moveTo(V.X(head.x + side * 0.38), V.Y(head.y))
    ctx.lineTo(V.X(head.x + side * (r + 0.04)), V.Y(head.y))
    ctx.stroke()
  }
  // Which way it's being pulled.
  if (Math.abs(g.pull) > 0.02) {
    ctx.strokeStyle = C.cyan
    ctx.lineWidth = V.S(0.02)
    ctx.beginPath()
    ctx.moveTo(V.X(0.5), V.Y(0.97))
    ctx.lineTo(V.X(0.5 + g.pull * 0.35), V.Y(0.97))
    ctx.stroke()
  }
}

// The squeeze, for the games that take one: a track up the right side, its knob at the
// pointer's height while pressed (higher squeezes harder).
function drawSqueeze(ctx, V, input) {
  const x = 0.95
  ctx.strokeStyle = C.faint
  ctx.lineWidth = V.S(0.02)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(V.X(x), V.Y(SQUEEZE_BOTTOM))
  ctx.lineTo(V.X(x), V.Y(SQUEEZE_TOP))
  ctx.stroke()
  ctx.lineCap = 'butt'
  if (!input.down) return
  const y = Math.min(SQUEEZE_BOTTOM, Math.max(SQUEEZE_TOP, input.y))
  ctx.strokeStyle = C.cyan
  ctx.lineWidth = V.S(0.02)
  ctx.beginPath()
  ctx.moveTo(V.X(x), V.Y(SQUEEZE_BOTTOM))
  ctx.lineTo(V.X(x), V.Y(y))
  ctx.stroke()
  ctx.fillStyle = C.cyan
  circle(ctx, V.X(x), V.Y(y), V.S(0.03))
  ctx.fill()
}

function drawHold(ctx, g, V, run) {
  const x0 = 0.4, x1 = 0.6, y0 = 0.08, y1 = 0.92
  const at = (n) => y1 - (y1 - y0) * n
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.fillRect(V.X(x0), V.Y(y0), V.S(x1 - x0), V.S(y1 - y0))
  // The band to keep it in.
  ctx.fillStyle = 'rgba(52, 211, 153, 0.28)'
  ctx.fillRect(V.X(x0), V.Y(at(HOLD_BAND + g.half)), V.S(x1 - x0), V.S((y1 - y0) * 2 * g.half))
  const out = Math.abs(g.needle - HOLD_BAND) > g.half
  ctx.strokeStyle = out ? C.bad : C.ring
  ctx.lineWidth = V.S(0.014)
  ctx.strokeRect(V.X(x0), V.Y(y0), V.S(x1 - x0), V.S(y1 - y0))
  // The needle.
  const y = at(g.needle)
  ctx.fillStyle = out ? C.bad : C.amber
  ctx.fillRect(V.X(x0 - 0.04), V.Y(y) - V.S(0.012), V.S(x1 - x0 + 0.08), V.S(0.024))
  ctx.beginPath()
  ctx.moveTo(V.X(x0 - 0.04), V.Y(y) - V.S(0.03))
  ctx.lineTo(V.X(x0 - 0.04), V.Y(y) + V.S(0.03))
  ctx.lineTo(V.X(x0 + 0.01), V.Y(y))
  ctx.fill()
  // A surge: red pressing up from below.
  const surging = g.surges.some(([from, to]) => g.t >= from && g.t < to)
  if (surging) {
    ctx.fillStyle = 'rgba(244, 63, 94, 0.5)'
    ctx.fillRect(V.X(x0), V.Y(y), V.S(x1 - x0), V.Y(y1) - V.Y(y))
  }
  drawSqueeze(ctx, V, run.input)
}

function drawMatch(ctx, g, V, run) {
  const target = MATCH.target(g)
  const on = Math.abs(g.ring - target) <= g.tolerance
  ctx.setLineDash([V.S(0.025), V.S(0.02)])
  ctx.strokeStyle = C.amber
  ctx.lineWidth = V.S(0.014)
  circle(ctx, V.X(0.5), V.Y(0.5), V.S(target))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.strokeStyle = on ? C.good : C.ring
  ctx.lineWidth = V.S(0.04)
  circle(ctx, V.X(0.5), V.Y(0.5), V.S(g.ring))
  ctx.stroke()
  drawSqueeze(ctx, V, run.input)
}

function drawStop(ctx, g, V) {
  const ring = { x: 0.5, y: 0.14 }
  const cup = { x0: 0.32, x1: 0.68, y0: 0.32, y1: 0.92 }
  const at = (level) => cup.y1 - (cup.y1 - cup.y0) * level
  // The ring closes on a press; the stream thins and stops.
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.04)
  circle(ctx, V.X(ring.x), V.Y(ring.y), V.S(0.03 + 0.05 * g.open))
  ctx.stroke()
  if (g.open > 0) {
    ctx.strokeStyle = C.amber
    ctx.lineWidth = V.S(0.035 * g.open)
    ctx.beginPath()
    ctx.moveTo(V.X(ring.x), V.Y(ring.y + 0.05))
    ctx.lineTo(V.X(ring.x), V.Y(at(g.level)))
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.fillRect(V.X(cup.x0), V.Y(cup.y0), V.S(cup.x1 - cup.x0), V.S(cup.y1 - cup.y0))
  ctx.fillStyle = 'rgba(52, 211, 153, 0.3)'
  ctx.fillRect(V.X(cup.x0), V.Y(at(g.low + g.width)), V.S(cup.x1 - cup.x0), V.Y(at(g.low)) - V.Y(at(g.low + g.width)))
  ctx.fillStyle = C.amber
  ctx.fillRect(V.X(cup.x0), V.Y(at(g.level)), V.S(cup.x1 - cup.x0), V.Y(cup.y1) - V.Y(at(g.level)))
  ctx.strokeStyle = C.faint
  ctx.lineWidth = V.S(0.012)
  ctx.strokeRect(V.X(cup.x0), V.Y(cup.y0), V.S(cup.x1 - cup.x0), V.S(cup.y1 - cup.y0))
}

function drawRelease(ctx, g, V) {
  const spike = RELEASE.spike(g)
  const now = g.t >= g.end && g.t <= g.end + g.window
  // The ring: clenched while held, green the moment to let go.
  const r = g.held ? 0.13 : 0.19
  ctx.strokeStyle = now ? C.good : g.held ? C.cyan : C.ring
  ctx.lineWidth = V.S(0.05)
  if (now) {
    ctx.shadowColor = C.good
    ctx.shadowBlur = V.S(0.06)
  }
  circle(ctx, V.X(0.5), V.Y(0.42), V.S(r))
  ctx.stroke()
  ctx.shadowBlur = 0
  // Before the spike, a halo calls for the hold.
  if (!g.held && g.t < g.begin) {
    ctx.strokeStyle = `rgba(241, 245, 249, ${0.25 + 0.2 * Math.sin(g.t * 10)})`
    ctx.lineWidth = V.S(0.012)
    circle(ctx, V.X(0.5), V.Y(0.42), V.S(0.25))
    ctx.stroke()
  }
  // The spike's size.
  const x0 = 0.2, x1 = 0.8, y = 0.8
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'
  ctx.fillRect(V.X(x0), V.Y(y), V.S(x1 - x0), V.S(0.06))
  ctx.fillStyle = spike > RELEASE_ON ? C.bad : C.faint
  ctx.fillRect(V.X(x0), V.Y(y), V.S((x1 - x0) * spike), V.S(0.06))
}

function drawPulse(ctx, g, V) {
  const next = g.beats.find((b) => !b.hit)
  // The ring, and the next beat closing in on it.
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.05)
  circle(ctx, V.X(0.5), V.Y(0.45), V.S(0.12))
  ctx.stroke()
  if (next) {
    const lead = next.at - g.t
    if (lead < g.gap * 1.2) {
      ctx.strokeStyle = Math.abs(lead) <= g.window ? C.amber : 'rgba(251, 191, 36, 0.55)'
      ctx.lineWidth = V.S(0.02)
      circle(ctx, V.X(0.5), V.Y(0.45), V.S(0.12 + Math.max(0, lead) * 0.4))
      ctx.stroke()
    }
  }
  for (const beat of g.beats) {
    if (beat.hit && g.t - beat.hitAt < 0.3) {
      ctx.strokeStyle = `rgba(34, 211, 238, ${1 - (g.t - beat.hitAt) / 0.3})`
      ctx.lineWidth = V.S(0.02)
      circle(ctx, V.X(0.5), V.Y(0.45), V.S(0.12 + (g.t - beat.hitAt) * 0.5))
      ctx.stroke()
    }
  }
  // The beats, in a row: hit, and still to come.
  g.beats.forEach((beat, i) => {
    ctx.fillStyle = beat.hit ? C.cyan : C.faint
    circle(ctx, V.X(0.5 + (i - (g.beats.length - 1) / 2) * 0.09), V.Y(0.82), V.S(0.022))
    ctx.fill()
  })
}

function drawSteady(ctx, g, V, run) {
  const inside = run.input.down && Math.hypot(run.input.x - g.x, run.input.y - g.y) <= g.radius
  ctx.fillStyle = inside ? 'rgba(52, 211, 153, 0.18)' : 'rgba(251, 113, 133, 0.12)'
  circle(ctx, V.X(g.x), V.Y(g.y), V.S(g.radius))
  ctx.fill()
  ctx.strokeStyle = inside ? C.good : C.ring
  ctx.lineWidth = V.S(0.02)
  circle(ctx, V.X(g.x), V.Y(g.y), V.S(g.radius))
  ctx.stroke()
  // Waiting for the press: it pulses.
  if (g.since === null) {
    ctx.strokeStyle = `rgba(241, 245, 249, ${0.3 + 0.25 * Math.sin(g.t * 12)})`
    ctx.lineWidth = V.S(0.01)
    circle(ctx, V.X(g.x), V.Y(g.y), V.S(g.radius * 1.35))
    ctx.stroke()
  }
}

function drawDodge(ctx, g, V) {
  ctx.strokeStyle = C.faint
  ctx.lineWidth = V.S(0.008)
  ctx.beginPath()
  ctx.moveTo(V.X(0.04), V.Y(DODGE_Y + 0.06))
  ctx.lineTo(V.X(0.96), V.Y(DODGE_Y + 0.06))
  ctx.stroke()
  // You: a small bladder.
  ctx.fillStyle = C.deep
  circle(ctx, V.X(g.x), V.Y(DODGE_Y), V.S(0.045))
  ctx.fill()
  ctx.strokeStyle = C.ring
  ctx.lineWidth = V.S(0.014)
  ctx.stroke()
  ctx.fillStyle = C.amber
  circle(ctx, V.X(g.x), V.Y(DODGE_Y + 0.012), V.S(0.025))
  ctx.fill()
  // The spikes.
  ctx.fillStyle = C.bad
  for (const spike of g.falling) {
    const w = DODGE_REACH * 0.55
    ctx.beginPath()
    ctx.moveTo(V.X(spike.x - w), V.Y(spike.y - 0.05))
    ctx.lineTo(V.X(spike.x + w), V.Y(spike.y - 0.05))
    ctx.lineTo(V.X(spike.x), V.Y(spike.y + 0.03))
    ctx.fill()
  }
}

const SCENES = {
  clench: drawClench, push: drawPush, seal: drawSeal, balance: drawBalance,
  hold: drawHold, match: drawMatch, stop: drawStop, release: drawRelease,
  pulse: drawPulse, steady: drawSteady, dodge: drawDodge,
}

// --- The frame around them -----------------------------------------------------

function drawVerb(ctx, area, verb, t, boss) {
  const pop = 1 + 0.35 * Math.max(0, 1 - t / 0.18)
  text(ctx, verb, area.left + area.size / 2, area.top + area.size * 0.42, area.size * 0.15 * pop, boss ? C.boss : C.ink)
}

function drawFuse(ctx, area, left) {
  const y = area.top + area.size + FUSE_ROOM / 2
  const width = area.size * 0.9
  const x = area.left + area.size * 0.05
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)'
  ctx.fillRect(x, y - 3, width, 6)
  ctx.fillStyle = left < 0.3 ? C.bad : C.amber
  ctx.fillRect(x, y - 3, width * left, 6)
  ctx.fillStyle = '#fff7ed'
  ctx.shadowColor = C.amber
  ctx.shadowBlur = 10
  circle(ctx, x + width * left, y, 5)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawResult(ctx, area, won, t) {
  const cx = area.left + area.size / 2
  const cy = area.top + area.size / 2
  const r = area.size * 0.16 * (1 + 0.25 * Math.max(0, 1 - t / 0.15))
  ctx.globalAlpha = Math.min(1, 1.6 - t)
  ctx.fillStyle = won ? 'rgba(6, 78, 59, 0.85)' : 'rgba(136, 19, 55, 0.85)'
  circle(ctx, cx, cy, r)
  ctx.fill()
  ctx.strokeStyle = won ? C.good : C.bad
  ctx.lineWidth = r * 0.18
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (won) {
    ctx.moveTo(cx - r * 0.45, cy + r * 0.02)
    ctx.lineTo(cx - r * 0.1, cy + r * 0.38)
    ctx.lineTo(cx + r * 0.5, cy - r * 0.35)
  } else {
    ctx.moveTo(cx - r * 0.38, cy - r * 0.38)
    ctx.lineTo(cx + r * 0.38, cy + r * 0.38)
    ctx.moveTo(cx + r * 0.38, cy - r * 0.38)
    ctx.lineTo(cx - r * 0.38, cy + r * 0.38)
  }
  ctx.stroke()
  ctx.lineCap = 'butt'
  ctx.globalAlpha = 1
}

// Where the pointer is pressing, so a finger can see what it does.
function drawTouch(ctx, V, input) {
  if (!input.down) return
  ctx.strokeStyle = 'rgba(241, 245, 249, 0.35)'
  ctx.lineWidth = 2
  circle(ctx, V.X(input.x), V.Y(input.y), V.S(0.05))
  ctx.stroke()
}

// One frame of `run` (sim.micro), or nothing between runs.
export function drawMicro(ctx, run, width, height) {
  ctx.clearRect(0, 0, width, height)
  if (!run) return
  const area = playArea(width, height)
  const V = view(area)
  // Dark while a game is on; it clears for the result, so the bladder behind shows its reaction.
  const shade = run.phase === 'result' ? SHADE - 0.62 * Math.min(1, run.t / 0.25) : SHADE
  ctx.fillStyle = `rgba(2, 6, 23, ${shade})`
  ctx.fillRect(0, 0, width, height)

  if (run.phase === 'boss') {
    const pulse = 1 + 0.06 * Math.sin(run.t * 18)
    text(ctx, t('micro.boss'), area.left + area.size / 2, area.top + area.size * 0.45, area.size * 0.2 * pulse, C.boss)
    return
  }
  ctx.save()
  if (run.phase === 'result') ctx.globalAlpha = 1 - 0.75 * Math.min(1, run.t / 0.25)
  SCENES[run.game.id]?.(ctx, run.g, V, run)
  ctx.restore()
  if (run.phase === 'play') {
    drawTouch(ctx, V, run.input)
    drawFuse(ctx, area, Math.max(0, 1 - run.t / run.duration))
  } else if (run.phase === 'prompt') {
    drawVerb(ctx, area, t(`verb.${run.game.id}`), run.t, !!run.boss)
  } else if (run.phase === 'result') {
    drawResult(ctx, area, run.won, run.t)
  }
}
