const router = require('express').Router()
const pool   = require('../db')
const { authenticate, requireRole } = require('../middleware/auth')

const mgr = [authenticate, requireRole('manager','director','admin')]

// GET /api/sites
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sites ORDER BY id')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// POST /api/sites
router.post('/', ...mgr, async (req, res) => {
  const { name, loc, type, reg_no, inspect_expiry } = req.body
  if (!name) return res.status(400).json({ error: 'Thiếu tên công trường' })
  try {
    const { rows } = await pool.query(
      'INSERT INTO sites (name,loc,type,reg_no,inspect_expiry) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, loc||'', type||null, reg_no||null, inspect_expiry||null]
    )
    res.status(201).json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// PUT /api/sites/:id
router.put('/:id', ...mgr, async (req, res) => {
  const { name, loc, type, reg_no, inspect_expiry } = req.body
  try {
    const { rows } = await pool.query(
      'UPDATE sites SET name=$1,loc=$2,type=$3,reg_no=$4,inspect_expiry=$5 WHERE id=$6 RETURNING *',
      [name, loc||'', type||null, reg_no||null, inspect_expiry||null, req.params.id]
    )
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// DELETE /api/sites/:id
router.delete('/:id', ...mgr, async (req, res) => {
  try {
    await pool.query('DELETE FROM sites WHERE id=$1', [req.params.id])
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
