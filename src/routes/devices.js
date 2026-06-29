const router = require('express').Router()
const db     = require('../firestore')
const { authenticate, requireRole } = require('../middleware/auth')

const mgr = [authenticate, requireRole('manager', 'admin')]

async function enrichDevice(d, sites, users, tickets) {
  const site  = sites.find(s => s.id === d.site_id)
  const user  = users.find(u => u.id === d.assigned_to)
  const hasOpen = tickets.some(t => t.device_id === d.id && ['pending','in_progress'].includes(t.status))
  return { ...d, site_name: site?.name||null, site_loc: site?.loc||null, site_type: site?.type||null, assigned_name: user?.name||null, assigned_email: user?.email||null, has_open_ticket: hasOpen }
}

router.get('/', authenticate, async (req, res) => {
  try {
    const [devices, sites, users, tickets] = await Promise.all([
      db.getAll('scct_devices'), db.getAll('scct_sites'),
      db.getAll('scct_users'),  db.getAll('scct_tickets')
    ])
    const result = await Promise.all(devices.map(d => enrichDevice(d, sites, users, tickets)))
    res.json(result.sort((a,b) => a.name?.localeCompare(b.name)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/mine', authenticate, async (req, res) => {
  try {
    const [devices, sites, tickets] = await Promise.all([
      db.getAll('scct_devices'), db.getAll('scct_sites'), db.getAll('scct_tickets')
    ])
    const mine = devices.filter(d => d.assigned_to === req.user.id)
    const result = mine.map(d => {
      const site = sites.find(s => s.id === d.site_id)
      const openCount = tickets.filter(t => t.device_id === d.id && ['pending','in_progress'].includes(t.status)).length
      return { ...d, site_name: site?.name||null, site_loc: site?.loc||null, site_type: site?.type||null, has_open_ticket: openCount > 0, open_ticket_count: openCount }
    })
    res.json(result.sort((a,b) => a.name?.localeCompare(b.name)))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', ...mgr, async (req, res) => {
  const { name, type, status, site_id, assigned_to, reg_no, inspect_expiry, description } = req.body
  if (!name) return res.status(400).json({ error: 'Thiếu tên thiết bị' })
  try {
    const device = await db.add('scct_devices', { name, type: type||'', status: status||'normal', site_id: site_id||null, assigned_to: assigned_to||null, reg_no: reg_no||null, inspect_expiry: inspect_expiry||null, description: description||'', created_at: new Date().toISOString() })
    res.status(201).json(device)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Nhập hàng loạt. Frontend đã map tên công trường/người → site_id/assigned_to và
// validate, nên ở đây chỉ guard tối thiểu (name bắt buộc) rồi ghi theo lô.
router.post('/bulk', ...mgr, async (req, res) => {
  const { devices } = req.body
  if (!Array.isArray(devices) || devices.length === 0)
    return res.status(400).json({ error: 'Danh sách thiết bị trống' })
  if (devices.length > 500)
    return res.status(400).json({ error: 'Tối đa 500 thiết bị mỗi lần nhập' })
  const bad = devices.findIndex(d => !d || !d.name)
  if (bad >= 0)
    return res.status(400).json({ error: `Dòng ${bad + 1}: thiếu tên thiết bị` })

  try {
    const now = new Date().toISOString()
    const created = []
    const CHUNK = 20  // giới hạn số ghi song song để không quá tải Firestore REST
    for (let i = 0; i < devices.length; i += CHUNK) {
      const part = await Promise.all(devices.slice(i, i + CHUNK).map(d =>
        db.add('scct_devices', {
          name: d.name, type: d.type || '', status: d.status || 'normal',
          site_id: d.site_id || null, assigned_to: d.assigned_to || null,
          reg_no: d.reg_no || null, inspect_expiry: d.inspect_expiry || null,
          description: d.description || '', created_at: now,
        })
      ))
      created.push(...part)
    }
    res.status(201).json({ created: created.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id', ...mgr, async (req, res) => {
  const { name, type, status, site_id, assigned_to, reg_no, inspect_expiry, description } = req.body
  try {
    await db.update('scct_devices', req.params.id, { name, type: type||'', status: status||'normal', site_id: site_id||null, assigned_to: assigned_to||null, reg_no: reg_no||null, inspect_expiry: inspect_expiry||null, description: description||'' })
    const device = await db.get('scct_devices', req.params.id)
    res.json(device)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', ...mgr, async (req, res) => {
  try {
    await db.delete('scct_devices', req.params.id)
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
