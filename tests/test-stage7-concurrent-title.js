const assert = require('assert')
const Y = require('yjs')

function patch(doc, text, next) {
  const previous = text.toString()
  let start = 0; while (previous[start] === next[start] && start < previous.length && start < next.length) start++
  let end = 0; while (previous[previous.length - 1 - end] === next[next.length - 1 - end] && end < previous.length - start && end < next.length - start) end++
  doc.transact(() => { if (previous.length - start - end) text.delete(start, previous.length - start - end); if (next.slice(start, next.length - end)) text.insert(start, next.slice(start, next.length - end)) })
}

const seed = new Y.Doc(); seed.getText('title').insert(0, 'Design')
const left = new Y.Doc(); const right = new Y.Doc(); const initial = Y.encodeStateAsUpdate(seed)
Y.applyUpdate(left, initial); Y.applyUpdate(right, initial)
patch(left, left.getText('title'), 'Design Notes')
patch(right, right.getText('title'), 'Product Design')
Y.applyUpdate(left, Y.encodeStateAsUpdate(right)); Y.applyUpdate(right, Y.encodeStateAsUpdate(left))
assert.strictEqual(left.getText('title').toString(), right.getText('title').toString())
assert(left.getText('title').toString().includes('Design'), 'shared title characters must survive concurrent patches')
console.log('PASS: concurrent minimal-diff title edits converge without title clobbering')
