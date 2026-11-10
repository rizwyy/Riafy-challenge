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
    const expenseWithoutDate = { ...exampleExpense, amount: '0.10' }
    delete expenseWithoutDate.date
    assert.equal(store.add(expenseWithoutDate).date, today())
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


test('date defaults to today only when omitted on creation and editing', () => {
  const store = createStore(':memory:')
  const expenseWithoutDate = { ...exampleExpense }
  delete expenseWithoutDate.date

  try {
    const expense = store.add(expenseWithoutDate)
    assert.equal(expense.date, today())

    const leapDay = '2024-02-29'
    assert.equal(store.add({ ...exampleExpense, date: leapDay }).date, leapDay)
    assert.equal(store.update(expense.id, { ...exampleExpense, date: leapDay }).date, leapDay)
    assert.equal(store.update(expense.id, expenseWithoutDate).date, today())
  } finally {
    store.close()
  }
})

test('invalid supplied dates are rejected on creation and editing without changing data', () => {
  const store = createStore(':memory:')
  const invalidDates = [
    false,
    true,
    0,
    123,
    null,
    undefined,
    [],
    ['2026-11-10'],
    {},
    { date: '2026-11-10' },
    '',
    ' ',
    'not-a-date',
    '2026-02-30',
    '2025-02-29',
    '2026-13-01',
    '2026-00-01',
    '2026-11-31',
    '2026-1-01',
    '2026-01-01T00:00:00Z',
    ' 2026-01-01 '
  ]

  try {
    const originalExpense = store.add(exampleExpense)
    for (const date of invalidDates) {
      const input = { ...exampleExpense, title: 'Must not be saved', date }
      const expectedError = { statusCode: 400, statusMessage: 'Enter a valid date.' }
      assert.throws(() => store.add(input), expectedError)
      assert.throws(() => store.update(originalExpense.id, input), expectedError)
      assert.deepEqual(store.list(), [originalExpense])
    }
  } finally {
    store.close()
  }
})


test('partial title filters ignore Unicode case and combine with other filters', () => {
  const store = createStore(':memory:')
  try {
    const coffee = store.add({ ...exampleExpense, title: 'Coffee at CAFÉ' })
    store.add({ ...exampleExpense, title: 'CAFÉ bus', category: 'Transport' })
    assert.deepEqual(
      store.list({ title: 'café', category: 'Food', from: exampleExpense.date, to: exampleExpense.date }),
      [coffee]
    )
    assert.deepEqual(store.list({ title: "' OR 1=1 --" }), [])
  } finally {
    store.close()
  }
})
