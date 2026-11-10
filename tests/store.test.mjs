import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStore, today } from '../server/utils/store.mjs'

const example = { title: '  Coffee  ', amount: '12.35', category: 'Food', date: '2026-05-03', note: 'Morning' }
test('create, list, sort, filter, edit and delete', () => {
  const s = createStore(':memory:')
  try {
    assert.deepEqual(s.list(), [])
    const a = s.add(example)
    assert.equal(a.title, 'Coffee'); assert.equal(a.amount, 12.35); assert.equal(a.note, 'Morning')
    const b = s.add({ ...example, title: 'Bus', category: 'Transport', date: '2026-05-04', note: '' })
    assert.deepEqual(s.list().map(x => x.id), [b.id, a.id])
    assert.deepEqual(s.list({ title: 'OFF', category: 'Food', from: '2026-05-03', to: '2026-05-03' }).map(x => x.id), [a.id])
    assert.deepEqual(s.list({ title: 'missing' }), [])
    assert.equal(s.update(a.id, { ...example, title: 'Tea', amount: '9.99' }).title, 'Tea')
    assert.equal(s.update(999, example), null)
    assert.equal(s.delete(a.id), true); assert.equal(s.delete(a.id), false)
    assert.equal(s.list().length, 1)
  } finally { s.close() }
})
test('default date and current month summary ignore older expenses', () => {
  const s = createStore(':memory:')
  try {
    assert.equal(s.summary().total, 0)
    assert.equal(s.add({ ...example, date: '', amount: '0.10' }).date, today())
    s.add({ ...example, date: today(), amount: '0.20' })
    s.add({ ...example, date: today(), category: 'Bills', amount: '10.00' })
    s.add({ ...example, date: '2000-01-01', amount: '100' })
    assert.deepEqual(s.summary(), { month: today().slice(0, 7), total: 10.3, categories: [{ category: 'Bills', total: 10 }, { category: 'Food', total: 0.3 }] })
  } finally { s.close() }
})
test('reject invalid inputs and date ranges', () => {
  const s = createStore(':memory:')
  try {
    for (const data of [{ title: '  ' }, { title: 'x'.repeat(101) }, { amount: 0 }, { amount: -5 }, { amount: '1.234' }, { amount: 'abc' }, { amount: null }, { category: 'Invalid' }, { date: '2026-02-30' }, { note: 23 }]) assert.throws(() => s.add({ ...example, ...data }), { statusCode: 400 })
    assert.throws(() => s.list({ from: '2026-05-05', to: '2026-05-04' }), { statusCode: 400 })
    assert.throws(() => s.list({ from: 'not-a-date' }), { statusCode: 400 })
    assert.throws(() => s.list({ category: 'Invalid' }), { statusCode: 400 })
  } finally { s.close() }
})

test('expenses persist after reopening the database', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = mkdtempSync(join(tmpdir(), 'expense-test-'))
  const path = join(directory, 'test.sqlite')
  try {
    const first = createStore(path)
    first.add(example)
    first.close()
    const second = createStore(path)
    assert.equal(second.list()[0].title, 'Coffee')
    second.close()
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
