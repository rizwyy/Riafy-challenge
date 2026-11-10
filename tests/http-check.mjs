import assert from 'node:assert/strict'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3101'

async function request(path, method = 'GET', body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  })
  const data = await response.json()
  return { status: response.status, data }
}

const testTitle = `HTTP test ${Date.now()}`
const expenseDetails = {
  title: testTitle,
  amount: '12.34',
  category: 'Food',
  note: 'test'
}
const currentDate = new Date()
const expectedToday = [
  currentDate.getFullYear(),
  String(currentDate.getMonth() + 1).padStart(2, '0'),
  String(currentDate.getDate()).padStart(2, '0')
].join('-')
let expenseId

try {
  let result = await request('/api/expenses', 'POST', expenseDetails)
  assert.equal(result.status, 201)
  expenseId = result.data.id
  assert.equal(result.data.amount, 12.34)
  assert.equal(result.data.date, expectedToday)

  result = await request(`/api/expenses?title=${encodeURIComponent(testTitle)}&category=Food`)
  assert.equal(result.status, 200)
  assert.equal(result.data.length, 1)
  assert.equal(result.data[0].id, expenseId)

  result = await request(`/api/expenses/${expenseId}`, 'PUT', {
    title: testTitle,
    amount: '20',
    category: 'Bills',
    date: '2026-01-01',
    note: 'changed'
  })
  assert.equal(result.status, 200)
  assert.equal(result.data.note, 'changed')

  result = await request(`/api/expenses/${expenseId}`, 'PUT', expenseDetails)
  assert.equal(result.status, 200)
  assert.equal(result.data.date, expectedToday)

  result = await request(`/api/expenses/${expenseId}`, 'PUT', {
    ...expenseDetails,
    date: '2024-02-29'
  })
  assert.equal(result.status, 200)
  assert.equal(result.data.date, '2024-02-29')

  const titleQuery = `/api/expenses?title=${encodeURIComponent(testTitle)}`
  const expensesBeforeInvalidDates = (await request(titleQuery)).data
  const invalidDates = [
    false, true, 0, 123, null, [], ['2026-11-10'], {}, { date: '2026-11-10' },
    '', ' ', 'not-a-date', '2026-02-30', '2025-02-29', '2026-13-01',
    '2026-00-01', '2026-11-31', '2026-1-01', '2026-01-01T00:00:00Z', ' 2026-01-01 '
  ]
  for (const date of invalidDates) {
    const invalidExpense = { ...expenseDetails, note: 'Must not be saved', date }
    const creation = await request('/api/expenses', 'POST', invalidExpense)
    const update = await request(`/api/expenses/${expenseId}`, 'PUT', invalidExpense)
    for (const response of [creation, update]) {
      assert.equal(response.status, 400, `Expected invalid date rejection: ${JSON.stringify(date)}`)
      assert.equal(response.data.statusMessage, 'Enter a valid date.')
    }
  }
  assert.deepEqual((await request(titleQuery)).data, expensesBeforeInvalidDates)

  assert.equal(
    (await request('/api/expenses', 'POST', { title: '', amount: -1 })).status,
    400
  )
  assert.equal(
    (await request('/api/expenses?from=2026-02-10&to=2026-02-01')).status,
    400
  )
  assert.equal((await request('/api/expenses/99999999', 'DELETE')).status, 404)
  assert.equal((await request('/api/summary')).status, 200)
  assert.equal((await request(`/api/expenses/${expenseId}`, 'DELETE')).status, 200)
  expenseId = null

  console.log('HTTP checks passed: create, filter, edit, invalid input/range, missing record, summary, delete, date validation on creation/editing')
} finally {
  if (expenseId) await request(`/api/expenses/${expenseId}`, 'DELETE')
}
