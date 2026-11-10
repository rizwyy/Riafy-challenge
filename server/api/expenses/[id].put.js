import { store } from '../../utils/db.mjs'

export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'id')
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid expense ID.' })
  const expense = store.update(Number(id), await readBody(event))
  if (!expense) throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  return expense
})
