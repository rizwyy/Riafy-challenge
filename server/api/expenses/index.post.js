import { store } from '../../utils/db.mjs'

export default defineEventHandler(async event => {
  const expense = store.add(await readBody(event))
  setResponseStatus(event, 201)
  return expense
})
