const router  = require('express').Router()
const pool    = require('../db')
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' })
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()])
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'Email không tồn tại' })
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Mật khẩu không đúng' })
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })
    const { password_hash, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/change-password
router.post('/change-password', require('../middleware/auth').authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' })
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id])
    const valid = await bcrypt.compare(oldPassword, rows[0].password_hash)
    if (!valid) return res.status(401).json({ error: 'Mật khẩu cũ không đúng' })
    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id])
    res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
