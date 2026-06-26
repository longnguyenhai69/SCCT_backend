const router = require('express').Router()
const pool   = require('../db')
const { authenticate, requireRole } = require('../middleware/auth')

const mgr = [authenticate, requireRole('manager','admin')]

// GET /api/devices  — kèm thông tin site, user, và has_open_ticket
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*,
             s.name  AS site_name, s.loc AS site_loc, s.type AS site_type,
             u.name  AS assigned_name, u.email AS assigned_email,
             EXISTS(
               SELECT 1 FROM tickets t
               WHERE t.device_id = d.id AND t.status IN ('pending','in_progress')
             ) AS has_open_ticket
      FROM devices d
      LEFT JOIN sites s ON d.site_id = s.id
      LEFT JOIN users u ON d.assigned_to = u.id
      ORDER BY d.id
    `)
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET /api/devices/mine  — thiết bị của nhân viên hiện tại
router.get('/mine', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT d.*,
             s.name AS site_name, s.loc AS site_loc, s.type AS site_type,
             EXISTS(
               SELECT 1 FROM tickets t
               WHERE t.device_id = d.id AND t.status IN ('pending','in_progress')
             ) AS has_open_ticket,
             (SELECT COUNT(*) FROM tickets t
              WHERE t.device_id = d.id AND t.status IN ('pending','in_progress')) AS open_ticket_count
      FROM devices d
      LEFT JOIN sites s ON d.site_id = s.id
      WHERE d.assigned_to = $1
      ORDER BY s.name, d.name
    `, [req.user.id])
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/devices
router.post('/', ...mgr, async (req, res) => {
  const { name, type, status, site_id, assigned_to, reg_no, inspect_expiry, description } = req.body
  if (!name) return res.status(400).json({ error: 'Thiếu tên thiết bị' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO devices (name,type,status,site_id,assigned_to,reg_no,inspect_expiry,description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, type||'', status||'normal', site_id||null, assigned_to||null,
       reg_no||null, inspect_expiry||null, description||'']
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/devices/:id
router.put('/:id', ...mgr, async (req, res) => {
  const { name, type, status, site_id, assigned_to, reg_no, inspect_expiry, description } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE devices SET name=$1,type=$2,status=$3,site_id=$4,assigned_to=$5,
       reg_no=$6,inspect_expiry=$7,description=$8 WHERE id=$9 RETURNING *`,
      [name, type||'', status||'normal', site_id||null, assigned_to||null,
       reg_no||null, inspect_expiry||null, description||'', req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/devices/:id
router.delete('/:id', ...mgr, async (req, res) => {
  try {
    await pool.query('DELETE FROM devices WHERE id=$1', [req.params.id])
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
