const router = require('express').Router()
const pool   = require('../db')
const { authenticate, requireRole } = require('../middleware/auth')

// Helper: lấy ticket đầy đủ với assignees & updates
async function getTicketFull(id) {
  const { rows: [t] } = await pool.query(`
    SELECT tk.*,
           d.name  AS device_name, d.type AS device_type,
           s.name  AS site_name,
           u.name  AS creator_name,
           ab.name AS approved_by_name
    FROM tickets tk
    LEFT JOIN devices d  ON tk.device_id  = d.id
    LEFT JOIN sites   s  ON tk.site_id    = s.id
    LEFT JOIN users   u  ON tk.user_id    = u.id
    LEFT JOIN users   ab ON tk.approved_by = ab.id
    WHERE tk.id = $1
  `, [id])
  if (!t) return null

  const { rows: assignees } = await pool.query(
    `SELECT u.id, u.name, u.role FROM ticket_assignees ta
     JOIN users u ON ta.user_id = u.id WHERE ta.ticket_id = $1`, [id]
  )
  const { rows: updates } = await pool.query(
    `SELECT tu.*, u.name AS user_name FROM ticket_updates tu
     JOIN users u ON tu.user_id = u.id
     WHERE tu.ticket_id = $1 ORDER BY tu.created_at`, [id]
  )
  return { ...t, assignees, updates }
}

// GET /api/tickets
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT tk.*,
             d.name AS device_name, s.name AS site_name, u.name AS creator_name
      FROM tickets tk
      LEFT JOIN devices d ON tk.device_id = d.id
      LEFT JOIN sites   s ON tk.site_id   = s.id
      LEFT JOIN users   u ON tk.user_id   = u.id
      ORDER BY tk.created_at DESC
    `)
    // Gắn assignees cho mỗi ticket
    const ids = rows.map(r => r.id)
    if (ids.length === 0) return res.json([])
    const { rows: all_assignees } = await pool.query(
      `SELECT ta.ticket_id, u.id, u.name FROM ticket_assignees ta
       JOIN users u ON ta.user_id = u.id WHERE ta.ticket_id = ANY($1)`, [ids]
    )
    const assigneeMap = {}
    all_assignees.forEach(a => {
      if (!assigneeMap[a.ticket_id]) assigneeMap[a.ticket_id] = []
      assigneeMap[a.ticket_id].push({ id: a.id, name: a.name })
    })
    res.json(rows.map(t => ({ ...t, assignees: assigneeMap[t.id] || [] })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/tickets/mine  — phiếu của nhân viên hiện tại (tạo hoặc được phân công)
router.get('/mine', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT tk.*,
             d.name AS device_name, s.name AS site_name
      FROM tickets tk
      LEFT JOIN devices d ON tk.device_id = d.id
      LEFT JOIN sites   s ON tk.site_id   = s.id
      LEFT JOIN ticket_assignees ta ON ta.ticket_id = tk.id
      WHERE tk.user_id = $1 OR ta.user_id = $1
      ORDER BY tk.created_at DESC
    `, [req.user.id])
    const ids = rows.map(r => r.id)
    if (ids.length === 0) return res.json([])
    const { rows: upds } = await pool.query(
      `SELECT * FROM ticket_updates WHERE ticket_id = ANY($1) ORDER BY created_at`, [ids]
    )
    const updMap = {}
    upds.forEach(u => { if (!updMap[u.ticket_id]) updMap[u.ticket_id] = []; updMap[u.ticket_id].push(u) })
    res.json(rows.map(t => ({ ...t, updates: updMap[t.id] || [] })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/tickets  — tạo phiếu sự cố
router.post('/', authenticate, async (req, res) => {
  const { device_id, site_id, description, plan, due_date, other_label,
          incident_time, operating_hours, operator, initial_cause } = req.body
  if (!description) return res.status(400).json({ error: 'Thiếu mô tả sự cố' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO tickets
         (device_id,site_id,user_id,status,description,plan,due_date,other_label,
          incident_time,operating_hours,operator,initial_cause)
       VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [device_id||null, site_id||null, req.user.id, description, plan||'',
       due_date||null, other_label||'',
       incident_time||null, operating_hours||null, operator||'', initial_cause||'']
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/tickets/:id/approve  — trưởng phòng phê duyệt + phân công
router.put('/:id/approve', authenticate, requireRole('manager'), async (req, res) => {
  const { approved_plan, assignee_ids, due_date } = req.body
  const today = new Date().toISOString().slice(0, 10)
  try {
    await pool.query(
      `UPDATE tickets SET status='in_progress', approved_plan=$1, approved_by=$2,
       approved_date=$3, due_date=COALESCE($4, due_date) WHERE id=$5`,
      [approved_plan||'', req.user.id, today, due_date||null, req.params.id]
    )
    // Xoá assignees cũ
    await pool.query('DELETE FROM ticket_assignees WHERE ticket_id=$1', [req.params.id])
    // Thêm assignees mới
    if (assignee_ids?.length) {
      for (const uid of assignee_ids) {
        await pool.query(
          'INSERT INTO ticket_assignees (ticket_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [req.params.id, uid]
        )
      }
    }
    res.json(await getTicketFull(req.params.id))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/tickets/:id/updates  — thêm nhật ký tiến độ
router.post('/:id/updates', authenticate, async (req, res) => {
  const { note } = req.body
  if (!note) return res.status(400).json({ error: 'Thiếu nội dung cập nhật' })
  try {
    await pool.query(
      'INSERT INTO ticket_updates (ticket_id, user_id, note) VALUES ($1,$2,$3)',
      [req.params.id, req.user.id, note]
    )
    res.json(await getTicketFull(req.params.id))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/tickets/:id/resolve  — giải quyết xong
router.put('/:id/resolve', authenticate, async (req, res) => {
  const { resolve_note } = req.body
  const today = new Date().toISOString().slice(0, 10)
  try {
    await pool.query(
      `UPDATE tickets SET status='resolved', resolved_date=$1, resolve_note=$2 WHERE id=$3`,
      [today, resolve_note||'', req.params.id]
    )
    res.json(await getTicketFull(req.params.id))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/tickets/:id
router.delete('/:id', authenticate, requireRole('manager','admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM tickets WHERE id=$1', [req.params.id])
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
