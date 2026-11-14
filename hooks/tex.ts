// Pure helpers: TeX to Unicode, and splitting a reply into markdown and display math.

const SYM: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
  theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π',
  rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', times: '×', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', to: '→',
  rightarrow: '→', leftarrow: '←', infty: '∞', sum: '∑', prod: '∏', int: '∫', partial: '∂', nabla: '∇',
  in: '∈', propto: '∝', sim: '∼', pm: '±', ldots: '…', dots: '…', cdots: '⋯', equiv: '≡',
  Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', implies: '⟹', iff: '⟺', mapsto: '↦',
  leftrightarrow: '↔', top: '⊤', perp: '⊥', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', neg: '¬', land: '∧', lor: '∨', ll: '≪', gg: '≫', circ: '∘', star: '⋆',
  mid: '∣', ast: '∗', langle: '⟨', rangle: '⟩', lVert: '‖', rVert: '‖', Vert: '‖', emptyset: '∅',
  ell: 'ℓ', hbar: 'ℏ', angle: '∠', deg: 'deg', det: 'det', tr: 'tr',
  arg: 'arg', argmax: 'argmax', argmin: 'argmin', lim: 'lim', sin: 'sin', cos: 'cos', tanh: 'tanh',
  exp: 'exp', log: 'log', ln: 'ln', max: 'max', min: 'min', sup: 'sup', inf: 'inf',
  ',': ' ', ';': ' ', ':': ' ', '!': '', quad: ' ', qquad: '  ',
}
const BB: Record<string, string> = { E: '𝔼', R: 'ℝ', N: 'ℕ', Z: 'ℤ', P: 'ℙ' }
const SUP = Object.fromEntries([...'0123456789+-=()ni'].map((c, i) => [c, [...'⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ'][i]!]))
const SUB = Object.fromEntries([...'0123456789+-=()aeoxhklmnpstijruv'].map((c, i) => [c, [...'₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼᵣᵤᵥ'][i]!]))

const SCRIPTS = [...Object.values(SUP), ...Object.values(SUB)]
const script = (g: string, map: Record<string, string>) => [...g].every(c => map[c]) ? [...g].map(c => map[c]).join('') : null

// ponytail: regex passes, no parser; deeply nested braces (x^{y_{i}}) stay partly raw.
export function toUnicode(tex: string): string {
  let s = tex.replace(/\\[td]?frac(?![a-zA-Z])\s*(\w)\s*(\w)/g, '\\frac{$1}{$2}').replace(/\\[td]frac(?![a-zA-Z])/g, '\\frac').replace(/\\(?:left|right)\s*\./g, '').replace(/\\(?:left|right)(?![a-zA-Z])/g, '')
  for (let p = ''; p !== s; ) { // innermost wrapper first, repeat for nesting
    p = s
    s = s.replace(/\\(?:mathrm|mathbf|mathsf|mathit|mathcal|mathscr|mathfrak|boldsymbol|bm|text|operatorname)\{([^{}]*)\}/g, '$1')
  }
  s = s.replace(/\\(?:mathrm|mathbf|mathsf|mathit|mathcal|mathscr|mathfrak|boldsymbol|bm)\s*(\w)/g, '$1') // unbraced: \mathbf p
  s = s.replace(/\\(?:mathbf|boldsymbol|bm)\s*(?=\\[a-zA-Z])/g, '') // \boldsymbol\alpha
  s = s.replace(/\\\$/g, '$').replace(/\\\{/g, '\u0001').replace(/\\\}/g, '\u0002') // escaped $ { } are literal
  s = s.replace(/\\mathbb\s*(?:\{(\w)\}|(\w))/g, (a, b, c) => BB[b ?? c] ?? b ?? c)
  s = s.replace(/\\([a-zA-Z]+|[,;:!])/g, (a, n) => SYM[n] ?? a)
  s = s.replace(/([\^_])(?:\{([^{}]*)\}|(.))/g, (a, op, br, ch) => {
    const g: string = br ?? ch
    return script(g, op === '^' ? SUP : SUB) ?? (br === undefined ? a : `${op}(${g})`)
  })
  const one = (x: string) => (/^[\w.]+$/.test(x) ? x : `(${x})`)
  for (let p = ''; p !== s; ) {
    p = s
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (a, n, d, i: number, all: string) => {
      const f = `${one(n)}/${one(d)}`
      const nx = all[i + a.length] // a script after the frac applies to the whole fraction
      return nx && ('^_'.includes(nx) || SCRIPTS.includes(nx)) ? `(${f})` : f
    })
  }
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
  return s.replace(/[{}]/g, '').replace(/\u0001/g, '{').replace(/\u0002/g, '}').replace(/ {2,}/g, ' ').trim()
}

// Code that stays untouched: fences (3+ backticks or tildes, closed by the same char, as long or longer),
// code spans (N backticks closed by exactly N), and an escaped dollar.
const CODE =
  '(?<fence>(?<fc>[`~])\\k<fc>{2,})[\\s\\S]*?(?:\\k<fence>\\k<fc>*|$)' +
  '|(?<tick>`+)(?!`)(?:(?!\\n\\n)[\\s\\S])*?(?<!`)\\k<tick>(?!`)' +
  '|\\\\\\$'
const DISPLAY = new RegExp(`(?<code>${CODE})|\\$\\$(?<d1>[\\s\\S]+?)\\$\\$|\\\\\\[(?<d2>[\\s\\S]+?)\\\\\\]`, 'g')
// pandoc: opening $ not before a space, closing $ not after a space nor before a digit; `\$` inside is not a delimiter.
const INLINE = new RegExp(
  `(?<code>${CODE})|\\\\\\((?<p>.+?)\\\\\\)|\\$(?<d>(?:\\\\.|[^\\s$\\\\])(?:(?:\\\\.|[^$\\n\\\\])*?(?:\\\\.|[^\\s$\\\\]))?)\\$(?!\\d)`,
  'g',
)

export type Segment = { kind: 'md' | 'display'; text: string }

export function splitSegments(text: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(DISPLAY)) {
    if (m.groups!.code !== undefined) continue // code or \$: stays in the markdown
    out.push({ kind: 'md', text: text.slice(last, m.index) })
    out.push({ kind: 'display', text: (m.groups!.d1 ?? m.groups!.d2)!.trim() })
    last = m.index + m[0].length
  }
  out.push({ kind: 'md', text: text.slice(last) })
  return out.filter(s => s.text.trim())
}

// Inline math to Unicode, escaped so markdown does not read its _ * as emphasis.
export const inlineMath = (md: string) =>
  md.replace(INLINE, (all, ...a) => { const g = a.at(-1) as Record<string, string | undefined>; return g.code !== undefined ? all : toUnicode((g.p ?? g.d)!).replace(/[*_~`\\]/g, '\\$&') })

// cyrb53: short stable key for a TeX string.
export function hash(s: string): string {
  let a = 0xdeadbeef, b = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ c, 2654435761)
    b = Math.imul(b ^ c, 1597334677)
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909)
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)
  return 'h' + (4294967296 * (2097151 & b) + (a >>> 0)).toString(36)
}
