import { expect, test } from 'claude-code/testing'

import { hash, inlineMath, splitSegments, toUnicode } from './tex'

const MSG = (text: string) =>
  ({
    plugin: 'tex-render',
    component: 'AssistantMessage',
    requestId: 'm1',
    surface: 'terminal',
    props: { text, isFirstOfReply: true },
  }) as const

test('toUnicode', async () => {
  expect(toUnicode('\\alpha_t')).toBe('αₜ')
  expect(toUnicode('\\mathbb{E}_{p}')).toBe('𝔼ₚ')
  expect(toUnicode('\\frac{1}{2}')).toBe('1/2')
  expect(toUnicode('p_{i,t+1} = \\dfrac{p_{it}\\,e^{-\\alpha_t y_i}}{Z_t}')).toBe('pᵢ,ₜ₊₁ = (pᵢₜ e^(-αₜ yᵢ))/Zₜ')
  expect(toUnicode('\\operatorname{sign}\\big(\\mathbf p\\big)')).toBe('sign(p)')
  expect(toUnicode('e^{-\\alpha}')).toBe('e^(-α)')
})

test('splitSegments skips code and \\$', async () => {
  const text = 'a $$x^2$$ b\n```\n$$no$$\n```\n`$$no$$` \\$5 and \\$$6$$ c \\[y\\]'
  const d = splitSegments(text).filter(s => s.kind === 'display').map(s => s.text)
  expect(d).toEqual(['x^2', 'y'])
})

test('a display formula draws an Image from state, plain text passes on', async ($, on) => {
  const tex = 'x^2'
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAYAAAD+Bd/7AAAAm0lEQVR4nD2NsQ3DIBBFOcvuoUGCytkg3iAjMIJHYIVswAZZwZskG+AGkGhIR0FBPlGUk0739f+7O2KonPO1tWaIaEX73ruAPbSlUgqvte5aaxdjNAgcghsgP8/z9gVgMiHEG4CD5IB39itC/yuE8MT2HcCRUlqVUidhy+DcY5qmDdMDuIwAvgNoCeT4Z3HgZGhojsmWZTmklK8PaNZHylssXmUAAAAASUVORK5CYII='
  on('state.get', () => ({
    value: { value: { shape: 'renders-1', value: { [hash(tex)]: { png, width: 120, height: 80 } } }, version: 1 },
  }))

  const ui = await $.ui.mount(MSG('so\n$$x^2$$\ndone'))
  expect(await ui.find({ type: 'Image' })).toBeTruthy()
  await ui.unmount()
})

test('text without math is left to the engine', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount(MSG('no math, costs 5 dollars'))
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  expect(await ui.find({ type: 'Image' })).toBeFalsy()
  await ui.unmount()
})

test('code and escapes are respected', async () => {
  const d = (t: string) => splitSegments(t).filter(s => s.kind === 'display')
  expect(d('~~~\n$$no$$\n~~~\n````\n```\n$$no$$\n````')).toEqual([])
  expect(inlineMath('`` $x$ `` and ~~~ $y$ ~~~')).toBe('`` $x$ `` and ~~~ $y$ ~~~')
  expect(inlineMath('see $a\\$b$ ok')).toBe('see a$b ok')
  expect(toUnicode('\\frac{a}{b}^2')).toBe('(a/b)²')
  expect(toUnicode('\\frac{a}{b}+1')).toBe('a/b+1')
  expect(toUnicode('\\{x,y\\}')).toBe('{x,y}')
})
