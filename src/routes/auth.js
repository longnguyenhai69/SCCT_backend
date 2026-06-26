const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt    = require('jsonwebtoken')
const db     = require('../firestore')

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' })
  try {
    const users = await db.where('scct_users', 'email', email.toLowerCase().trim())
    if (!users.length) return res.status(401).json({ error: 'Email không tồn tại' })
    const user = users[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Mật khẩu không đúng' })
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })
    const { password_hash, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/change-password', require('../middleware/auth').authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' })
  try {
    const user = await db.get('scct_users', req.user.id)
    const valid = await bcrypt.compare(oldPassword, user.password_hash)
    if (!valid) return res.status(401).json({ error: 'Mật khẩu cũ không đúng' })
    const hash = await bcrypt.hash(newPassword, 10)
    await db.update('scct_users', req.user.id, { password_hash: hash })
    res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
