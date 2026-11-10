import assert from 'node:assert/strict'
const base = process.env.BASE_URL || 'http://127.0.0.1:3101'
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json()
  return { status: response.status, data }
}
const prefix = `HTTP test ${Date.now()}`
let id
try {
  let r = await request('/api/expenses', 'POST', { title: prefix, amount: '12.34', category: 'Food', note: 'test' })
  assert.equal(r.status, 201); id = r.data.id; assert.equal(r.data.amount, 12.34)
  r = await request(`/api/expenses?title=${encodeURIComponent(prefix)}&category=Food`)
  assert.equal(r.status, 200); assert.equal(r.data.length, 1); assert.equal(r.data[0].id, id)
  r = await request(`/api/expenses/${id}`, 'PUT', { title: prefix, amount: '20', category: 'Bills', date: '2026-01-01', note: 'changed' })
  assert.equal(r.status, 200); assert.equal(r.data.note, 'changed')
  assert.equal((await request('/api/expenses', 'POST', { title: '', amount: -1 })).status, 400)
  assert.equal((await request('/api/expenses?from=2026-02-10&to=2026-02-01')).status, 400)
  assert.equal((await request('/api/expenses/99999999', 'DELETE')).status, 404)
  assert.equal((await request('/api/summary')).status, 200)
  assert.equal((await request(`/api/expenses/${id}`, 'DELETE')).status, 200); id = null
  console.log('HTTP checks passed: create, filter, edit, invalid input/range, missing record, summary, delete')
} finally { if (id) await request(`/api/expenses/${id}`, 'DELETE') }
