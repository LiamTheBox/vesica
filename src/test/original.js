import { readFileSync } from 'node:fs'

// Reads values straight out of the original single-file game so tests compare the
// port against the real reference instead of hand-copied numbers.

const ORIGINAL_PATH = new URL('../../Vesica 3D Mobile Web App.html', import.meta.url)

let source = null
function originalSource() {
  source ??= readFileSync(ORIGINAL_PATH, 'utf8')
  return source
}

// Evaluates a top-level `const NAME = { ... };` object literal from the original script.
export function extractOriginalConst(name) {
  const src = originalSource()
  const start = src.indexOf(`const ${name} = {`)
  if (start === -1) throw new Error(`const ${name} not found in original`)
  const open = src.indexOf('{', start)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}' && --depth === 0) {
      return new Function(`return (${src.slice(open, i + 1)})`)()
    }
  }
  throw new Error(`Unbalanced braces in const ${name}`)
}
