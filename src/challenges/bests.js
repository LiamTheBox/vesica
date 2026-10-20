// Best challenge results. Commute: fewest ml lost on a winning run. Precision: the
// void closest to 200 ml on a successful run.

export const EMPTY_BESTS = { commute: null, precision: null }

export function recordResult(bests, result) {
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

export function describeBest(challenge, best) {
  if (!best) return null
  if (challenge === 'commute') return `Best: ${best.leaked} ml lost`
  const offBy = best.voided - 200
  return `Best: ${best.voided} ml (${offBy === 0 ? 'perfect' : `${offBy > 0 ? '+' : ''}${offBy} ml`})`
}
