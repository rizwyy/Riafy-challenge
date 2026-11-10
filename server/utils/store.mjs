import { DatabaseSync } from 'node:sqlite'
export const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Other'
]

export function today() {
  // Keep the local calendar date; toISOString() would use UTC.
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function throwValidationError(message) {
  throw Object.assign(new Error(message), { statusCode: 400, statusMessage: message })
}

function validateExpense(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throwValidationError('Provide expense details.')
  }
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    input.title.trim().length > 100
  ) {
    throwValidationError('Title is required and must be at most 100 characters.')
  }
  const amount = typeof input.amount === 'string' ? input.amount.trim() : input.amount
  if (
    (typeof amount !== 'string' && typeof amount !== 'number') ||
    !/^\d+(?:\.\d{1,2})?$/.test(String(amount))
  ) {
    throwValidationError('Amount must be a positive number with at most two decimal places.')
  }
  // Store whole paise so totals do not accumulate floating-point rounding errors.
  const paise = Math.round(Number(amount) * 100)
  if (!Number.isSafeInteger(paise) || paise <= 0 || paise > 100000000000) {
    throwValidationError('Amount must be between ₹0.01 and ₹1,000,000,000.')
  }
  if (!categories.includes(input.category)) {
    throwValidationError('Choose a valid category.')
  }
  const date = Object.hasOwn(input, 'date') ? input.date : today()
  if (!isValidDate(date)) {
    throwValidationError('Enter a valid date.')
  }
  if (input.note != null && (typeof input.note !== 'string' || input.note.length > 2000)) {
    throwValidationError('Note must be at most 2000 characters.')
  }
  return {
    title: input.title.trim(),
    paise,
    category: input.category,
    date,
    note: (input.note || '').trim()
  }
}

function formatExpense(row) {
  return row && {
    id: row.id,
    title: row.title,
    amount: row.paise / 100,
    category: row.category,
    date: row.date,
    note: row.note
  }
}

export function createStore(path = process.env.EXPENSE_DB || 'expenses.sqlite') {
  const db = new DatabaseSync(path)
  db.exec(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    paise INTEGER NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL
  )`)

  return {
    list(filters = {}) {
      const { category, from, to, title } = filters
      if (category && !categories.includes(category)) {
        throwValidationError('Choose a valid category.')
      }
      if ((from && !isValidDate(from)) || (to && !isValidDate(to))) {
        throwValidationError('Enter valid filter dates.')
      }
      if (from && to && from > to) {
        throwValidationError('From date must not be after to date.')
      }
      if (title != null && typeof title !== 'string') {
        throwValidationError('Title filter must be text.')
      }

      let sql = 'SELECT * FROM expenses WHERE 1=1'
      const parameters = []
      if (category) {
        sql += ' AND category = ?'
        parameters.push(category)
      }
      if (from) {
        sql += ' AND date >= ?'
        parameters.push(from)
      }
      if (to) {
        sql += ' AND date <= ?'
        parameters.push(to)
      }
      if (title) {
        sql += ' AND instr(lower(title), lower(?)) > 0'
        parameters.push(title.trim())
      }
      return db.prepare(sql + ' ORDER BY date DESC, id DESC')
        .all(...parameters)
        .map(formatExpense)
    },
    add(input) {
      const expense = validateExpense(input)
      const result = db.prepare(
        'INSERT INTO expenses (title, paise, category, date, note) VALUES (?, ?, ?, ?, ?)'
      )
        .run(expense.title, expense.paise, expense.category, expense.date, expense.note)
      const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid)
      return formatExpense(row)
    },
    update(id, input) {
      const expense = validateExpense(input)
      const result = db.prepare('UPDATE expenses SET title=?, paise=?, category=?, date=?, note=? WHERE id=?')
        .run(expense.title, expense.paise, expense.category, expense.date, expense.note, id)
      return result.changes
        ? formatExpense(db.prepare('SELECT * FROM expenses WHERE id=?').get(id))
        : null
    },
    delete(id) {
      return Boolean(db.prepare('DELETE FROM expenses WHERE id=?').run(id).changes)
    },
    summary() {
      const month = today().slice(0, 7)
      const rows = db.prepare(
        'SELECT category, SUM(paise) AS total FROM expenses WHERE substr(date,1,7)=? GROUP BY category ORDER BY category'
      ).all(month)
      return {
        month,
        total: rows.reduce((sum, row) => sum + row.total, 0) / 100,
        categories: rows.map(row => ({ category: row.category, total: row.total / 100 }))
      }
    },
    close() {
      db.close()
    }
  }
}
