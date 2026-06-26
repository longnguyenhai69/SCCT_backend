const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db     = require('../firestore')
const { authenticate, requireRole } = require('../middleware/auth')

const adminOnly = [authenticate, requireRole('admin')]
const TECH_ROLES = ['tech', 'specialist', 'deputy_manager']

router.get('/', authenticate, async (req, res) => {
  try {
    const users = await db.getAll('scct_users')
    res.json(users.map(u => { const { password_hash, ...s } = u; return s }).sort((a,b) => a.name?.localeCompare(b.name)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/tech', authenticate, async (req, res) => {
  try {
    const users = await db.getAll('scct_users')
    res.json(users.filter(u => TECH_ROLES.includes(u.role)).map(u => { const { password_hash, ...s } = u; return s }).sort((a,b) => a.name?.localeCompare(b.name)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', ...adminOnly, async (req, res) => {
  const { name, email, role, password } = req.body
  if (!name || !email) return res.status(400).json({ error: 'Thiếu tên hoặc email' })
  try {
    const existing = await db.where('scct_users', 'email', email.toLowerCase().trim())
    if (existing.length) return res.status(400).json({ error: 'Email đã tồn tại' })
    const hash = await bcrypt.hash(password || 'scct@2026', 10)
    const user = await db.add('scct_users', { name, email: email.toLowerCase().trim(), password_hash: hash, role: role || 'tech', created_at: new Date().toISOString() })
    const { password_hash, ...safeUser } = user
    res.status(201).json(safeUser)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', ...adminOnly, async (req, res) => {
  const { name, email, role, password } = req.body
  try {
    const updates = { name, email: email.toLowerCase().trim(), role }
    if (password) updates.password_hash = await bcrypt.hash(password, 10)
    await db.update('scct_users', req.params.id, updates)
    const user = await db.get('scct_users', req.params.id)
    const { password_hash, ...safeUser } = user
    res.json(safeUser)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', ...adminOnly, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình' })
  try {
    await db.delete('scct_users', req.params.id)
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
