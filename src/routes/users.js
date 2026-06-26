const router = require('express').Router()
const pool   = require('../db')
const bcrypt = require('bcryptjs')
const { authenticate, requireRole } = require('../middleware/auth')

const adminOnly = [authenticate, requireRole('admin')]

// GET /api/users
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id'
    )
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/users/tech  — danh sách nhân viên kỹ thuật
router.get('/tech', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role FROM users
       WHERE role IN ('tech','specialist','deputy_manager') ORDER BY name`
    )
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/users
router.post('/', ...adminOnly, async (req, res) => {
  const { name, email, role, password } = req.body
  if (!name || !email) return res.status(400).json({ error: 'Thiếu tên hoặc email' })
  try {
    const hash = await bcrypt.hash(password || 'scct@2026', 10)
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role',
      [name, email.toLowerCase().trim(), hash, role || 'tech']
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email đã tồn tại' })
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/users/:id
router.put('/:id', ...adminOnly, async (req, res) => {
  const { name, email, role, password } = req.body
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await pool.query(
        'UPDATE users SET name=$1, email=$2, role=$3, password_hash=$4 WHERE id=$5',
        [name, email.toLowerCase().trim(), role, hash, req.params.id]
      )
    } else {
      await pool.query(
        'UPDATE users SET name=$1, email=$2, role=$3 WHERE id=$4',
        [name, email.toLowerCase().trim(), role, req.params.id]
      )
    }
    const { rows } = await pool.query(
      'SELECT id,name,email,role FROM users WHERE id=$1', [req.params.id]
    )
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email đã tồn tại' })
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/users/:id
router.delete('/:id', ...adminOnly, async (req, res) => {
  if (String(req.params.id) === String(req.user.id))
    return res.status(400).json({ error: 'Không thể xóa chính mình' })
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id])
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
