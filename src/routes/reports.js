const router = require('express').Router()
const pool   = require('../db')
const { authenticate, requireRole } = require('../middleware/auth')

// GET /api/reports  — trưởng phòng xem tất cả, nhân viên xem của mình
router.get('/', authenticate, async (req, res) => {
  try {
    const isMgr = ['manager','director','admin'].includes(req.user.role)
    const q = isMgr
      ? `SELECT r.*, u.name AS user_name, u.role AS user_role
         FROM reports r JOIN users u ON r.user_id = u.id ORDER BY r.month DESC, u.name`
      : `SELECT r.* FROM reports r WHERE r.user_id = $1 ORDER BY r.month DESC`
    const { rows } = isMgr
      ? await pool.query(q)
      : await pool.query(q, [req.user.id])
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/reports/stats/:month  — thống kê phiếu theo tháng cho từng nhân viên
router.get('/stats/:month', authenticate, async (req, res) => {
  const { month } = req.params
  try {
    const { rows: techUsers } = await pool.query(
      `SELECT id, name, role FROM users WHERE role IN ('tech','specialist','deputy_manager') ORDER BY name`
    )
    const stats = await Promise.all(techUsers.map(async u => {
      const { rows: [s] } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ta.user_id = $1 AND to_char(tk.approved_date,'YYYY-MM') = $2) AS assigned,
          COUNT(*) FILTER (WHERE ta.user_id = $1 AND tk.status = 'resolved' AND to_char(tk.resolved_date,'YYYY-MM') = $2) AS resolved,
          COUNT(*) FILTER (WHERE ta.user_id = $1 AND tk.status IN ('pending','in_progress')) AS open
        FROM tickets tk
        LEFT JOIN ticket_assignees ta ON ta.ticket_id = tk.id
        WHERE ta.user_id = $1 OR tk.user_id = $1
      `, [u.id, month])
      const { rows: [rep] } = await pool.query(
        `SELECT * FROM reports WHERE user_id = $1 AND month = $2`, [u.id, month]
      )
      return { user: u, stats: s, report: rep || null }
    }))
    res.json(stats)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/reports  — nhân viên nộp báo cáo tháng
router.post('/', authenticate, async (req, res) => {
  const { month, summary, self_rate } = req.body
  if (!month || !summary) return res.status(400).json({ error: 'Thiếu tháng hoặc nội dung' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO reports (user_id, month, summary, self_rate)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, month) DO UPDATE SET summary=$3, self_rate=$4, submitted_at=NOW()
       RETURNING *`,
      [req.user.id, month, summary, self_rate||'']
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/reports/:id/comment  — trưởng phòng nhận xét
router.put('/:id/comment', authenticate, requireRole('manager','director','admin'), async (req, res) => {
  const { mgr_comment } = req.body
  try {
    const { rows } = await pool.query(
      'UPDATE reports SET mgr_comment=$1 WHERE id=$2 RETURNING *',
      [mgr_comment||'', req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
