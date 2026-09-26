const assert = require('assert')
const fs = require('fs')
const path = require('path')

const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'globals.css'), 'utf8')
const editor = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'CollaborativeEditor.tsx'), 'utf8')

// Regression: when a dark OS preference is active, the optional light-paper
// canvas must still reset its ink tokens before TipTap mounts.
const lightPaperBlock = css.match(/\[data-light-paper="true"\]\s*\{([\s\S]*?)\n\}/)
assert(lightPaperBlock, 'Light-paper token override must exist')
assert(/--color-ink:\s*hsl\(30 8% 12%\)/.test(lightPaperBlock[1]), 'Light-paper canvas must define dark ink')
assert(/\.editor-prose\.ProseMirror\s*\{[\s\S]*?color:\s*var\(--color-ink\)\s*!important/.test(css), 'TipTap editor must explicitly consume the ink token')
assert(editor.includes("class: 'editor-prose focus:outline-none'"), 'TipTap editor must carry the explicit contrast class')

console.log('PASS: light-paper editor text resolves to the dark ink token')
