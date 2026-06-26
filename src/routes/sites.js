const router = require('express').Router()
const db     = require('../firestore')
const { authenticate, requireRole } = require('../middleware/auth')

const mgr = [authenticate, requireRole('manager', 'director', 'admin')]

router.get('/', authenticate, async (req, res) => {
  try {
    const sites = await db.getAll('scct_sites')
    res.json(sites.sort((a, b) => a.name?.localeCompare(b.name)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', ...mgr, async (req, res) => {
  const { name, loc, type, reg_no, inspect_expiry } = req.body
  if (!name) return res.status(400).json({ error: 'Thiếu tên công trường' })
  try {
    const site = await db.add('scct_sites', { name, loc: loc||'', type: type||null, reg_no: reg_no||null, inspect_expiry: inspect_expiry||null, created_at: new Date().toISOString() })
    res.status(201).json(site)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', ...mgr, async (req, res) => {
  const { name, loc, type, reg_no, inspect_expiry } = req.body
  try {
    await db.update('scct_sites', req.params.id, { name, loc: loc||'', type: type||null, reg_no: reg_no||null, inspect_expiry: inspect_expiry||null })
    const site = await db.get('scct_sites', req.params.id)
    res.json(site)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', ...mgr, async (req, res) => {
  try {
    await db.delete('scct_sites', req.params.id)
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
