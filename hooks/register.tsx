import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Rendered } from '../types'
import { hash, inlineMath, splitSegments, toUnicode } from './tex'

const COLOR = '#e6e6e6' // dark theme
const SCALE = 3
// ponytail: calibrate by eye. PX_PER_ROW = image px per terminal row at SCALE 3;
// CELL_ASPECT = cell height / width. No cell pixel size is exposed by the API.
const PX_PER_ROW = 40
const CELL_ASPECT = 2.1
const KEEP = 60 // newest formulas kept in state

const renders = atom({ plugin: 'tex-render', key: 'renders' } as const, {}, { shape: 'renders-1' })

export function fit({ width, height }: Rendered, maxCols: number) {
  let rows = Math.max(1, Math.round(height / PX_PER_ROW))
  let columns = Math.max(1, Math.round((width / height) * rows * CELL_ASPECT))
  if (columns > maxCols) {
    rows = Math.max(1, Math.round((rows * maxCols) / columns))
    columns = maxCols
  }
  return { columns: Math.min(columns, 255), rows: Math.min(rows, 255) }
}

let install: Promise<void> | undefined // one npm install in flight; cleared on failure so a later reply retries

// ponytail: `$` typed any, the per-hook dollar type has no exported name
function ensureInstall($: any) {
  return (install ??= (async () => {
    $.ui.toast('tex-render: installing renderer dependencies (first run)')
    const npm = await $.process.run(['npm', 'install', '--no-fund', '--no-audit', '--omit=dev'], {
      cwd: `${$.plugin.root}/renderer`,
      timeoutMs: 300000,
    })
    if (npm.exitCode !== 0) throw new Error(`npm install failed: ${npm.stderr.slice(0, 200)}`)
  })().catch(err => {
    install = undefined
    throw err
  }))
}

async function renderAll($: any, todo: string[]) {
  const render = () =>
    $.process.run(['node', `${$.plugin.root}/renderer/render.mjs`, COLOR, String(SCALE)], {
      stdin: JSON.stringify(todo),
      timeoutMs: 30000,
    })
  let run = await render()
  if (run.exitCode !== 0 && /ERR_MODULE_NOT_FOUND|Cannot find (module|package)/.test(run.stderr)) {
    await ensureInstall($) // concurrent renders share one install, then retry once
    run = await render()
  }
  if (run.exitCode !== 0) throw new Error(run.stderr.slice(0, 200))
  const got = JSON.parse(run.stdout) as Array<Rendered | { error: string }>
  const add: Record<string, Rendered> = {}
  todo.forEach((t, i) => {
    const r = got[i]
    if (r && 'png' in r) add[hash(t)] = r
  })
  await update($, renders, cur => Object.fromEntries(Object.entries({ ...cur, ...add }).slice(-KEEP)))
}

export const register: Register = on => {
  let warned = false
  on('session.append', { door: 'response' }, async ($, e, next) => {
    const texts = e.message.content.flatMap(b => (b.type === 'text' && typeof b.text === 'string' ? [b.text] : []))
    const known = await read($, renders).catch(() => ({}) as Record<string, Rendered>)
    const todo = [...new Set(texts.flatMap(t => splitSegments(t).filter(s => s.kind === 'display').map(s => s.text)))].filter(
      t => !known[hash(t)],
    )
    // Render off the hook: a session timer outlives the dispatch, so the transcript row is not held back.
    if (todo.length)
      $.clock.after(0, () => {
        void renderAll($, todo).catch(err => {
          if (!warned) {
            warned = true
            $.ui.log(`tex-render: renderer failed, showing Unicode: ${String(err).slice(0, 200)}`)
          }
        })
      })
    return next(e)
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isSummary || !/\$|\\[(\[]/.test(e.props.text)) return next(e)
    const segs = splitSegments(e.props.text).map(s => (s.kind === 'md' ? { ...s, text: inlineMath(s.text) } : s))
    if (segs.length === 1 && segs[0]!.text === e.props.text) return next(e)

    const { Box, Text, Markdown, Image } = $.ui.resolve(e)
    const known = await read($, renders)
    const maxCols = Math.min(e.viewport?.columns ?? 100, 255)

    return (
      <Box flexDirection="column">
        {segs.map(s => {
          if (s.kind === 'md') return <Markdown text={s.text} />
          const r = known[hash(s.text)]
          const uni = toUnicode(s.text.replace(/\s+/g, ' '))
          return (
            <Box marginY={1}>
              {r ? <Image source={{ png: r.png }} {...fit(r, maxCols)} alt={uni} /> : <Text>{uni}</Text>}
            </Box>
          )
        })}
      </Box>
    )
  })
}
