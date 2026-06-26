const axios = require('axios')
require('dotenv').config()

const PROJECT = process.env.FIREBASE_PROJECT_ID || 'scct-cb346'
const KEY     = process.env.FIREBASE_API_KEY    || 'AIzaSyDOSlLpduy4AFCb5uFw_9KsWrpxk7869KY'
const BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const QUERY   = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`

// ── Convert JS → Firestore field value ──────────────────────
function toVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean')        return { booleanValue: v }
  if (typeof v === 'number')         return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (typeof v === 'string')         return { stringValue: v }
  if (Array.isArray(v))             return { arrayValue: { values: v.map(toVal) } }
  if (v instanceof Date)            return { timestampValue: v.toISOString() }
  if (typeof v === 'object')        return { mapValue: { fields: toFields(v) } }
  return { stringValue: String(v) }
}
function toFields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) { if (v !== undefined) f[k] = toVal(v) }
  return f
}

// ── Convert Firestore → JS ───────────────────────────────────
function fromVal(v) {
  if (!v) return null
  if ('nullValue'      in v) return null
  if ('booleanValue'   in v) return v.booleanValue
  if ('integerValue'   in v) return parseInt(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('stringValue'    in v) return v.stringValue
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(fromVal)
  if ('mapValue'       in v) return fromFields(v.mapValue.fields || {})
  return null
}
function fromFields(fields) {
  const obj = {}
  for (const [k, v] of Object.entries(fields || {})) obj[k] = fromVal(v)
  return obj
}
function docToObj(doc) {
  return { id: doc.name.split('/').pop(), ...fromFields(doc.fields) }
}

// ── CRUD ─────────────────────────────────────────────────────
const db = {
  async getAll(col) {
    try {
      const { data } = await axios.get(`${BASE}/${col}?key=${KEY}`)
      return (data.documents || []).map(docToObj)
    } catch { return [] }
  },

  async get(col, id) {
    const { data } = await axios.get(`${BASE}/${col}/${id}?key=${KEY}`)
    return docToObj(data)
  },

  async add(col, obj) {
    const { data } = await axios.post(`${BASE}/${col}?key=${KEY}`, { fields: toFields(obj) })
    return docToObj(data)
  },

  async set(col, id, obj) {
    const { data } = await axios.patch(`${BASE}/${col}/${id}?key=${KEY}`, { fields: toFields(obj) })
    return docToObj(data)
  },

  async update(col, id, obj) {
    const fields = toFields(obj)
    const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
    const { data } = await axios.patch(`${BASE}/${col}/${id}?key=${KEY}&${mask}`, { fields })
    return docToObj(data)
  },

  async delete(col, id) {
    await axios.delete(`${BASE}/${col}/${id}?key=${KEY}`)
  },

  async where(col, field, value) {
    try {
      const { data } = await axios.post(`${QUERY}?key=${KEY}`, {
        structuredQuery: {
          from: [{ collectionId: col }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toVal(value) } }
        }
      })
      return (data || []).filter(r => r.document).map(r => docToObj(r.document))
    } catch { return [] }
  },

  async whereIn(col, field, values) {
    const all = await this.getAll(col)
    return all.filter(d => values.includes(d[field]))
  }
}

module.exports = db
