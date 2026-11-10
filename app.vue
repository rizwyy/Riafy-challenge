<script setup>
const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other']
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const blank = () => ({ title: '', amount: '', category: 'Food', date: localToday(), note: '' })
const form = ref(blank())
const filters = reactive({ title: '', category: '', from: '', to: '' })
const expenses = ref([])
const summary = ref({ month: '', total: 0, categories: [] })
const editing = ref(null)
const error = ref('')
const loading = ref(false)
const money = value => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
async function refresh() {
  error.value = ''
  try {
    const [list, totals] = await Promise.all([$fetch('/api/expenses', { query: filters }), $fetch('/api/summary')])
    expenses.value = list; summary.value = totals
  } catch (e) { error.value = e.data?.statusMessage || e.data?.message || 'Could not load expenses.' }
}
async function save() {
  error.value = ''; loading.value = true
  try {
    await $fetch(editing.value ? `/api/expenses/${editing.value}` : '/api/expenses', { method: editing.value ? 'PUT' : 'POST', body: form.value })
    cancel(); await refresh()
  } catch (e) { error.value = e.data?.statusMessage || e.data?.message || 'Could not save expense. Check the fields and try again.' }
  finally { loading.value = false }
}
function edit(expense) { editing.value = expense.id; form.value = { title: expense.title, amount: expense.amount, category: expense.category, date: expense.date, note: expense.note }; window.scrollTo({ top: 0, behavior: 'smooth' }) }
function cancel() { editing.value = null; form.value = blank() }
async function remove(expense) {
  if (!window.confirm(`Delete “${expense.title}”?`)) return
  try { await $fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' }); if (editing.value === expense.id) cancel(); await refresh() }
  catch (e) { error.value = e.data?.statusMessage || e.data?.message || 'Could not delete expense.' }
}
function clearFilters() { Object.assign(filters, { title: '', category: '', from: '', to: '' }); refresh() }
onMounted(refresh)
</script>

<template>
  <main>
    <header><p class="eyebrow">PERSONAL FINANCE</p><h1>Expense tracker</h1><p>Keep track of where your money goes.</p></header>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="top">
      <section class="card"><h2>{{ editing ? 'Edit expense' : 'Add an expense' }}</h2>
        <form @submit.prevent="save">
          <label>Title <input v-model="form.title" required maxlength="100" placeholder="Coffee at Starbucks"></label>
          <div class="pair"><label>Amount (₹) <input v-model="form.amount" required type="number" min="0.01" max="1000000000" step="0.01" placeholder="0.00"></label>
          <label>Category <select v-model="form.category" required><option v-for="c in categories" :key="c">{{ c }}</option></select></label></div>
          <label>Date <input v-model="form.date" required type="date"></label>
          <label>Note <span class="muted">(optional)</span><textarea v-model="form.note" maxlength="2000" rows="3" placeholder="Add a note"></textarea></label>
          <div class="actions"><button :disabled="loading">{{ editing ? 'Save changes' : 'Add expense' }}</button><button v-if="editing" type="button" class="secondary" @click="cancel">Cancel</button></div>
        </form>
      </section>
      <section class="card summary"><h2>This month</h2><p class="muted">{{ summary.month }}</p><p class="total">{{ money(summary.total) }}</p><p class="muted">Total spent</p><h3>By category</h3><p v-if="!summary.categories.length" class="muted">No expenses this month.</p><ul v-else><li v-for="item in summary.categories" :key="item.category"><span>{{ item.category }}</span><strong>{{ money(item.total) }}</strong></li></ul></section>
    </div>
    <section class="card"><h2>Expenses</h2>
      <form class="filters" @submit.prevent="refresh"><label>Search title<input v-model="filters.title" placeholder="Search expenses"></label><label>Category<select v-model="filters.category"><option value="">All categories</option><option v-for="c in categories" :key="c">{{ c }}</option></select></label><label>From<input v-model="filters.from" type="date"></label><label>To<input v-model="filters.to" type="date"></label><div class="actions"><button>Filter</button><button type="button" class="secondary" @click="clearFilters">Clear</button></div></form>
      <p v-if="!expenses.length" class="empty">No expenses found. Add one or change your filters.</p>
      <div v-else class="table-wrap"><table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Amount</th><th>Note</th><th>Actions</th></tr></thead><tbody><tr v-for="expense in expenses" :key="expense.id"><td>{{ expense.date }}</td><td>{{ expense.title }}</td><td>{{ expense.category }}</td><td>{{ money(expense.amount) }}</td><td class="note">{{ expense.note || '—' }}</td><td><div class="row-actions"><button class="link" @click="edit(expense)">Edit</button><button class="link danger" @click="remove(expense)">Delete</button></div></td></tr></tbody></table></div>
    </section>
  </main>
</template>
<style>
:root{font-family:system-ui,-apple-system,sans-serif;color:#17252a;background:#f3f6f4;font-size:15px}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:auto;padding:40px 24px 70px}header{margin-bottom:28px}h1{font-size:2.15rem;letter-spacing:-.04em;margin:5px 0}header p{color:#64756e;margin:0}.eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.13em;color:#327b61}h2{font-size:1.12rem;margin:0 0 20px}h3{font-size:.9rem;margin:28px 0 12px}.top{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;margin-bottom:20px}.card{background:#fff;border:1px solid #e1e9e3;border-radius:12px;padding:24px;box-shadow:0 3px 15px #183b2610}label{display:block;font-weight:600;font-size:.85rem}input,select,textarea{display:block;width:100%;border:1px solid #cfdcd3;border-radius:6px;padding:10px 11px;margin:7px 0 15px;font:inherit;color:inherit;background:#fff}textarea{resize:vertical}.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}.muted{color:#74827a;font-weight:400}.actions,.row-actions{display:flex;gap:8px;align-items:center}button{background:#236c50;border:0;border-radius:6px;color:white;font:inherit;font-weight:650;padding:10px 16px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.secondary{background:#eef3ef;color:#294b3a}.summary .total{font-size:2.4rem;font-weight:750;letter-spacing:-.04em;margin:15px 0 2px}.summary ul{list-style:none;margin:0;padding:0}.summary li{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #edf2ee}.filters{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr auto;gap:12px;align-items:end}.filters input,.filters select{margin-bottom:0}.filters .actions{padding-bottom:0}.empty{color:#74827a;padding:25px 0}.table-wrap{overflow:auto;margin-top:24px}table{width:100%;border-collapse:collapse;text-align:left}th,td{border-bottom:1px solid #edf2ee;padding:13px 10px;vertical-align:top}th{color:#718078;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}td{font-size:.9rem}.note{white-space:pre-wrap;min-width:120px;overflow-wrap:anywhere}.link{background:none;color:#236c50;padding:0}.danger{color:#a34040}.error{background:#fcebea;color:#932e2e;padding:12px;border-radius:6px}@media(max-width:800px){.top{grid-template-columns:1fr}.filters{grid-template-columns:1fr 1fr}.filters .actions{grid-column:1/-1}main{padding:25px 16px}}
</style>
