// The camera as the bladder notices it: zoomed right in, or spun round and round. StageFit
// reports the view as the player moves it; feedback.js turns what's noticed into an event.

// Closer than this share of the fitted distance is too close; it notices again once the
// view has backed off past BACK_OFF.
const TOO_CLOSE = 0.4
const BACK_OFF = 0.6
// This many full turns of orbit, without a long pause, makes it dizzy. Turns are forgotten
// at SPIN_FADE a second.
const DIZZY_TURNS = 2
const SPIN_FADE = 0.25

export function createCameraWatch() {
  return { close: false, turns: 0, azimuth: null, time: 0 }
}

// `zoom`: distance over the fitted distance; `azimuth`: the orbit angle (rad); `time` in s.
// Returns what it noticed, 'tooClose' or 'dizzy', or null.
export function watchCamera(watch, zoom, azimuth, time) {
  let noticed = null
  if (!watch.close && zoom < TOO_CLOSE) {
    watch.close = true
    noticed = 'tooClose'
  } else if (watch.close && zoom > BACK_OFF) {
    watch.close = false
  }

  if (watch.azimuth !== null) {
    let turn = azimuth - watch.azimuth
    turn -= Math.round(turn / (Math.PI * 2)) * Math.PI * 2 // the short way round
    watch.turns = Math.max(0, watch.turns - SPIN_FADE * (time - watch.time)) + Math.abs(turn) / (Math.PI * 2)
    if (watch.turns >= DIZZY_TURNS) {
      watch.turns = 0
      noticed ??= 'dizzy'
    }
  }
  watch.azimuth = azimuth
  watch.time = time
  return noticed
}
