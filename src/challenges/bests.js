// Best results. Commute: fewest ml lost on a winning run. Precision: the void closest to
// 200 ml on a successful run. Arcade: the highest score, banked or not. Microgames: the most
// games cleared in a run.

export const EMPTY_BESTS = { commute: null, precision: null, arcade: null, micro: null }

export function recordResult(bests, result) {
  if (result.challenge === 'micro') {
    if (!bests.micro || result.score > bests.micro.score) return { ...bests, micro: { score: result.score, level: result.level } }
    return bests
  }
  if (result.challenge === 'arcade') {
    if (bests.arcade === null || result.score > bests.arcade.score) {
      return { ...bests, arcade: { score: result.score, seconds: result.seconds } }
    }
    return bests
  }
  if (!result.success) return bests
  if (result.challenge === 'commute') {
    if (bests.commute === null || result.leaked < bests.commute.leaked) {
      return { ...bests, commute: { leaked: result.leaked } }
    }
  } else if (result.challenge === 'precision') {
    const offBy = Math.abs(result.voided - 200)
    if (bests.precision === null || offBy < Math.abs(bests.precision.voided - 200)) {
      return { ...bests, precision: { voided: result.voided } }
    }
  }
  return bests
}

// 95 -> "1:35"
export const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function describeBest(challenge, best) {
  if (!best) return null
  if (challenge === 'arcade') return `Best: ${best.score.toLocaleString('en-US')} pts (${clock(best.seconds)} held)`
  if (challenge === 'micro') return `Best: ${best.score} cleared (speed ${best.level})`
  if (challenge === 'commute') return `Best: ${best.leaked} ml lost`
  const offBy = best.voided - 200
  return `Best: ${best.voided} ml (${offBy === 0 ? 'perfect' : `${offBy > 0 ? '+' : ''}${offBy} ml`})`
}
