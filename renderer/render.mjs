// usage: node render.mjs <color> <scale>  (stdin: JSON array of TeX strings)
// stdout: JSON array of { png: base64, width, height } | { error }
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { Resvg } from '@resvg/resvg-js';

const [color = '#e6e6e6', scale = '2'] = process.argv.slice(2);
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'none' }) });

let input = '';
for await (const c of process.stdin) input += c;
const out = JSON.parse(input).map(tex => {
  try {
    let svg = adaptor.innerHTML(doc.convert(tex, { display: true }));
    if (svg.includes('data-mjx-error')) return { error: 'tex error' };
    svg = svg.replaceAll('currentColor', color);
    const img = new Resvg(svg, { fitTo: { mode: 'zoom', value: Number(scale) }, font: { loadSystemFonts: false } }).render();
    return { png: img.asPng().toString('base64'), width: img.width, height: img.height };
  } catch (e) { return { error: String(e.message ?? e) }; }
});
process.stdout.write(JSON.stringify(out));
