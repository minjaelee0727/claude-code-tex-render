# tex-render

A Claude Code mod that draws LaTeX math in replies: display formulas become images, inline math becomes Unicode.

## Requirements

- Claude Code with mods/plugins support.
- Node.js 18 or newer on `PATH`.
- For images: a terminal with the kitty graphics protocol (Ghostty, kitty, iTerm2 3.5+ in fullscreen). Other terminals show the Unicode fallback.
- tmux: set `allow-passthrough on` and `focus-events on`, then restart Claude Code.

## Install

```
/plugin install tex-render --marketplace minjaelee0727/claude-code-tex-render
```

Answer `y` to add the marketplace, then pick a scope.

On the first formula, the mod runs `npm install` in its `renderer/` folder (downloads `mathjax-full` and `@resvg/resvg-js`) and shows a toast. If that fails, replies keep the Unicode fallback and one line is logged.

## Usage

Claude Code does not write LaTeX in the terminal by default. Add a line such as "Write math in LaTeX: `$...$` inline, `$$...$$` for display." to your `CLAUDE.md`.


- Inline: `$x^2$` or `\(x^2\)` becomes Unicode text.
- Display: `$$ ... $$` or `\[ ... \]` becomes a PNG (MathJax SVG rendered by resvg), cached in plugin state.

## Calibration

Constants at the top of `hooks/register.tsx`:

- `PX_PER_ROW`: image pixels per terminal row at `SCALE` 3.
- `CELL_ASPECT`: terminal cell height / width.
- `COLOR`: formula color (default `#e6e6e6`, for dark themes; use a dark color such as `#1a1a1a` on a light theme).
- `SCALE`: render zoom.

Adjust `PX_PER_ROW` and `CELL_ASPECT` by eye until images match your font size.

## Limitations

- Inline math is Unicode only; complex nested expressions may stay partly raw.
- Replies written before the mod loaded are not rendered as images.
- Terminal only.

## License

MIT
