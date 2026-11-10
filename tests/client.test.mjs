import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { ref, reactive } from 'vue'

// Exercise the page's handlers with controlled requests; these are not browser tests.
function createClient(fetch, confirm = () => true) {
  const source = readFileSync(new URL('../app.vue', import.meta.url), 'utf8')
    .split('<script setup>')[1].split('</script>')[0]
  const context = {
    ref,
    reactive,
    onMounted() {},
    $fetch: fetch,
    window: { confirm, scrollTo() {} }
  }
  runInNewContext(source + `
    globalThis.client = {
      expenseForm, filters, expenses, monthlySummary, editingExpenseId,
      errorMessage, isSaving, saveExpense, editExpense, resetExpenseForm,
      deleteExpense, clearFilters
    }
  `, context)
  return context.client
}

const snapshot = value => JSON.parse(JSON.stringify(value))
const exampleExpense = {
  id: 7, title: 'Coffee', amount: 12.35,
  category: 'Food', date: '2026-11-10', note: 'Morning'
}
const emptySummary = { month: '2026-11', total: 0, categories: [] }

test('repeated saves while a request is pending issue only one POST', async () => {
  let releaseSave
  let creations = 0
  const pendingSave = new Promise(resolve => { releaseSave = resolve })
  const client = createClient((url, options = {}) => {
    if (options.method === 'POST') {
      creations++
      return pendingSave
    }
    return Promise.resolve(url === '/api/summary' ? emptySummary : [])
  })
  client.expenseForm.value = { ...exampleExpense }
  const first = client.saveExpense()
  const second = client.saveExpense()
  assert.equal(creations, 1)
  assert.equal(client.isSaving.value, true)
  releaseSave(exampleExpense)
  await Promise.all([first, second])
  assert.equal(client.isSaving.value, false)
})

test('failed creates and edits preserve form data and show the request error', async () => {
  for (const editing of [false, true]) {
    const client = createClient(async () => {
      throw { data: { statusMessage: 'Save failed during audit.' } }
    })
    if (editing) client.editExpense(exampleExpense)
    else client.expenseForm.value = { ...exampleExpense }
    const originalForm = snapshot(client.expenseForm.value)
    await client.saveExpense()
    assert.deepEqual(snapshot(client.expenseForm.value), originalForm)
    assert.equal(client.editingExpenseId.value, editing ? exampleExpense.id : null)
    assert.equal(client.errorMessage.value, 'Save failed during audit.')
    assert.equal(client.isSaving.value, false)
  }
})

test('cancel edit leaves the original record unchanged without a request', () => {
  let requests = 0
  const client = createClient(() => { requests++ })
  const original = { ...exampleExpense }
  client.editExpense(original)
  client.expenseForm.value.title = 'Unsaved change'
  client.resetExpenseForm()
  assert.deepEqual(original, exampleExpense)
  assert.equal(client.editingExpenseId.value, null)
  assert.equal(client.expenseForm.value.title, '')
  assert.equal(requests, 0)
})

test('delete cancellation makes no request; confirmation deletes and refreshes', async () => {
  let confirmed = false
  const requests = []
  const client = createClient(async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET' })
    return url === '/api/summary' ? emptySummary : []
  }, () => confirmed)
  await client.deleteExpense(exampleExpense)
  assert.deepEqual(requests, [])
  confirmed = true
  await client.deleteExpense(exampleExpense)
  assert.deepEqual(requests, [
    { url: '/api/expenses/7', method: 'DELETE' },
    { url: '/api/expenses', method: 'GET' },
    { url: '/api/summary', method: 'GET' }
  ])
})

test('clear filters fetches the full list and the independent summary', async () => {
  const requests = []
  const client = createClient(async (url, options = {}) => {
    requests.push({ url, query: snapshot(options.query || {}) })
    return url === '/api/summary' ? emptySummary : [exampleExpense]
  })
  Object.assign(client.filters, {
    title: 'Coffee', category: 'Food', from: '2026-11-01', to: '2026-11-10'
  })
  client.clearFilters()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, [
    { url: '/api/expenses', query: { title: '', category: '', from: '', to: '' } },
    { url: '/api/summary', query: {} }
  ])
  assert.deepEqual(snapshot(client.expenses.value), [exampleExpense])
  assert.deepEqual(snapshot(client.monthlySummary.value), emptySummary)
})
