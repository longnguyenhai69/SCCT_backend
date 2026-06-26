const router = require('express').Router()
const db     = require('../firestore')
const { authenticate, requireRole } = require('../middleware/auth')

async function enrichTicket(t, users, devices, sites) {
  const device  = devices.find(d => d.id === t.device_id)
  const site    = sites.find(s => s.id === t.site_id)
  const creator = users.find(u => u.id === t.user_id)
  const approver= users.find(u => u.id === t.approved_by)
  const assignees = (t.assignee_ids || []).map(id => users.find(u => u.id === id)).filter(Boolean).map(u => ({ id: u.id, name: u.name, role: u.role }))
  const updates = await db.where('scct_ticket_updates', 'ticket_id', t.id)
  const sortedUpdates = updates.sort((a,b) => a.created_at > b.created_at ? 1 : -1).map(u => ({ ...u, user_name: users.find(x => x.id === u.user_id)?.name }))
  return { ...t, device_name: device?.name||null, device_type: device?.type||null, site_name: site?.name||null, creator_name: creator?.name||null, approved_by_name: approver?.name||null, assignees, updates: sortedUpdates }
}

router.get('/', authenticate, async (req, res) => {
  try {
    const [tickets, users, devices, sites] = await Promise.all([
      db.getAll('scct_tickets'), db.getAll('scct_users'),
      db.getAll('scct_devices'), db.getAll('scct_sites')
    ])
    const result = await Promise.all(tickets.map(t => enrichTicket(t, users, devices, sites)))
    res.json(result.sort((a,b) => b.created_at > a.created_at ? 1 : -1))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/mine', authenticate, async (req, res) => {
  try {
    const [tickets, users, devices, sites] = await Promise.all([
      db.getAll('scct_tickets'), db.getAll('scct_users'),
      db.getAll('scct_devices'), db.getAll('scct_sites')
    ])
    const mine = tickets.filter(t => t.user_id === req.user.id || (t.assignee_ids || []).includes(req.user.id))
    const result = await Promise.all(mine.map(t => enrichTicket(t, users, devices, sites)))
    res.json(result.sort((a,b) => b.created_at > a.created_at ? 1 : -1))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', authenticate, async (req, res) => {
  const { device_id, site_id, description, plan, due_date, other_label, incident_time, operating_hours, operator, initial_cause } = req.body
  if (!description) return res.status(400).json({ error: 'Thiếu mô tả sự cố' })
  try {
    const ticket = await db.add('scct_tickets', {
      device_id: device_id||null, site_id: site_id||null, user_id: req.user.id,
      status: 'pending', description, plan: plan||'', due_date: due_date||null,
      other_label: other_label||'', approved_plan: null, approved_by: null,
      approved_date: null, resolved_date: null, resolve_note: null,
      incident_time: incident_time||null, operating_hours: operating_hours||null,
      operator: operator||'', initial_cause: initial_cause||'',
      assignee_ids: [], created_at: new Date().toISOString()
    })
    res.status(201).json(ticket)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id/approve', authenticate, requireRole('manager'), async (req, res) => {
  const { approved_plan, assignee_ids, due_date } = req.body
  try {
    await db.update('scct_tickets', req.params.id, {
      status: 'in_progress', approved_plan: approved_plan||'',
      approved_by: req.user.id, approved_date: new Date().toISOString().slice(0,10),
      due_date: due_date||null, assignee_ids: assignee_ids||[]
    })
    const [tickets, users, devices, sites] = await Promise.all([
      db.getAll('scct_tickets'), db.getAll('scct_users'), db.getAll('scct_devices'), db.getAll('scct_sites')
    ])
    const t = tickets.find(x => x.id === req.params.id)
    res.json(await enrichTicket(t, users, devices, sites))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/:id/updates', authenticate, async (req, res) => {
  const { note } = req.body
  if (!note) return res.status(400).json({ error: 'Thiếu nội dung cập nhật' })
  try {
    await db.add('scct_ticket_updates', { ticket_id: req.params.id, user_id: req.user.id, note, created_at: new Date().toISOString() })
    const [tickets, users, devices, sites] = await Promise.all([
      db.getAll('scct_tickets'), db.getAll('scct_users'), db.getAll('scct_devices'), db.getAll('scct_sites')
    ])
    const t = tickets.find(x => x.id === req.params.id)
    res.json(await enrichTicket(t, users, devices, sites))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id/resolve', authenticate, async (req, res) => {
  const { resolve_note } = req.body
  try {
    await db.update('scct_tickets', req.params.id, { status: 'resolved', resolved_date: new Date().toISOString().slice(0,10), resolve_note: resolve_note||'' })
    const [tickets, users, devices, sites] = await Promise.all([
      db.getAll('scct_tickets'), db.getAll('scct_users'), db.getAll('scct_devices'), db.getAll('scct_sites')
    ])
    const t = tickets.find(x => x.id === req.params.id)
    res.json(await enrichTicket(t, users, devices, sites))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.delete('/:id', authenticate, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const updates = await db.where('scct_ticket_updates', 'ticket_id', req.params.id)
    await Promise.all(updates.map(u => db.delete('scct_ticket_updates', u.id)))
    await db.delete('scct_tickets', req.params.id)
    res.json({ message: 'Đã xóa' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
