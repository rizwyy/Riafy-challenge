import { store } from '../../utils/db.mjs'

export default defineEventHandler(event => store.list(getQuery(event)))
