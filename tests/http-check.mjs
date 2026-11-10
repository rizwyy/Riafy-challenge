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
let expenseId

try {
  let result = await request('/api/expenses', 'POST', {
    title: testTitle,
    amount: '12.34',
    category: 'Food',
    note: 'test'
  })
  assert.equal(result.status, 201)
  expenseId = result.data.id
  assert.equal(result.data.amount, 12.34)

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

  console.log('HTTP checks passed: create, filter, edit, invalid input/range, missing record, summary, delete')
} finally {
  if (expenseId) await request(`/api/expenses/${expenseId}`, 'DELETE')
}
