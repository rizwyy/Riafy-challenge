import { store } from '../../utils/db.mjs'

export default defineEventHandler(event => {
  const id = getRouterParam(event, 'id')
  if (!/^\d+$/.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid expense ID.' })
  }
  if (!store.delete(Number(id))) {
    throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  }
  return { deleted: true }
})
