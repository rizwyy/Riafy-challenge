import { store } from '../utils/db.mjs'

export default defineEventHandler(() => store.summary())
