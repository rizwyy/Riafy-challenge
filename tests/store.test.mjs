import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createStore, today } from '../server/utils/store.mjs'

const exampleExpense = {
  title: '  Coffee  ',
  amount: '12.35',
  category: 'Food',
  date: '2026-05-03',
  note: 'Morning'
}

test('create, list, sort, filter, edit and delete', () => {
  const store = createStore(':memory:')
  try {
    assert.deepEqual(store.list(), [])
    const coffee = store.add(exampleExpense)
    assert.equal(coffee.title, 'Coffee')
    assert.equal(coffee.amount, 12.35)
    assert.equal(coffee.note, 'Morning')

    const bus = store.add({
      ...exampleExpense,
      title: 'Bus',
      category: 'Transport',
      date: '2026-05-04',
      note: ''
    })
    assert.deepEqual(store.list().map(expense => expense.id), [bus.id, coffee.id])
    assert.deepEqual(
      store.list({
        title: 'OFF',
        category: 'Food',
        from: '2026-05-03',
        to: '2026-05-03'
      }).map(expense => expense.id),
      [coffee.id]
    )
    assert.deepEqual(store.list({ title: 'missing' }), [])
    assert.equal(
      store.update(coffee.id, { ...exampleExpense, title: 'Tea', amount: '9.99' }).title,
      'Tea'
    )
    assert.equal(store.update(999, exampleExpense), null)
    assert.equal(store.delete(coffee.id), true)
    assert.equal(store.delete(coffee.id), false)
    assert.equal(store.list().length, 1)
  } finally {
    store.close()
  }
})

test('default date and current month summary ignore older expenses', () => {
  const store = createStore(':memory:')
  try {
    assert.equal(store.summary().total, 0)
    assert.equal(store.add({ ...exampleExpense, date: '', amount: '0.10' }).date, today())
    store.add({ ...exampleExpense, date: today(), amount: '0.20' })
    store.add({ ...exampleExpense, date: today(), category: 'Bills', amount: '10.00' })
    store.add({ ...exampleExpense, date: '2000-01-01', amount: '100' })
    assert.deepEqual(store.summary(), {
      month: today().slice(0, 7),
      total: 10.3,
      categories: [
        { category: 'Bills', total: 10 },
        { category: 'Food', total: 0.3 }
      ]
    })
  } finally {
    store.close()
  }
})

test('reject invalid inputs and date ranges', () => {
  const store = createStore(':memory:')
  try {
    const invalidFields = [
      { title: '  ' },
      { title: 'x'.repeat(101) },
      { amount: 0 },
      { amount: -5 },
      { amount: '1.234' },
      { amount: 'abc' },
      { amount: null },
      { category: 'Invalid' },
      { date: '2026-02-30' },
      { note: 23 }
    ]
    for (const fields of invalidFields) {
      assert.throws(() => store.add({ ...exampleExpense, ...fields }), { statusCode: 400 })
    }
    assert.throws(
      () => store.list({ from: '2026-05-05', to: '2026-05-04' }),
      { statusCode: 400 }
    )
    assert.throws(() => store.list({ from: 'not-a-date' }), { statusCode: 400 })
    assert.throws(() => store.list({ category: 'Invalid' }), { statusCode: 400 })
  } finally {
    store.close()
  }
})

test('expenses persist after reopening the database', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const directory = mkdtempSync(join(tmpdir(), 'expense-test-'))
  const path = join(directory, 'test.sqlite')
  try {
    const firstStore = createStore(path)
    firstStore.add(exampleExpense)
    firstStore.close()

    const reopenedStore = createStore(path)
    assert.equal(reopenedStore.list()[0].title, 'Coffee')
    reopenedStore.close()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
