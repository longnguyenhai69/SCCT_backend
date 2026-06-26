const router = require('express').Router()
const db     = require('../firestore')
const { authenticate, requireRole } = require('../middleware/auth')

const TECH_ROLES = ['tech', 'specialist', 'deputy_manager']

router.get('/', authenticate, async (req, res) => {
  try {
    const [reports, users] = await Promise.all([db.getAll('scct_reports'), db.getAll('scct_users')])
    const isMgr = ['manager','director','admin'].includes(req.user.role)
    const list = isMgr ? reports : reports.filter(r => r.user_id === req.user.id)
    const result = list.map(r => {
      const u = users.find(x => x.id === r.user_id)
      return { ...r, user_name: u?.name||null, user_role: u?.role||null }
    })
    res.json(result.sort((a,b) => b.month > a.month ? 1 : -1))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.get('/stats/:month', authenticate, async (req, res) => {
  const { month } = req.params
  try {
    const [users, tickets, reports] = await Promise.all([
      db.getAll('scct_users'), db.getAll('scct_tickets'), db.getAll('scct_reports')
    ])
    const techUsers = users.filter(u => TECH_ROLES.includes(u.role))
    const stats = techUsers.map(u => {
      const assigned = tickets.filter(t => (t.assignee_ids||[]).includes(u.id) && t.approved_date?.slice(0,7) === month).length
      const resolved = tickets.filter(t => (t.assignee_ids||[]).includes(u.id) && t.status === 'resolved' && t.resolved_date?.slice(0,7) === month).length
      const open     = tickets.filter(t => (t.assignee_ids||[]).includes(u.id) && ['pending','in_progress'].includes(t.status)).length
      const report   = reports.find(r => r.user_id === u.id && r.month === month) || null
      return { user: u, stats: { assigned: String(assigned), resolved: String(resolved), open: String(open) }, report }
    })
    res.json(stats)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.post('/', authenticate, async (req, res) => {
  const { month, summary, self_rate } = req.body
  if (!month || !summary) return res.status(400).json({ error: 'Thiếu tháng hoặc nội dung' })
  try {
    const existing = await db.where('scct_reports', 'user_id', req.user.id)
    const found = existing.find(r => r.month === month)
    if (found) {
      await db.update('scct_reports', found.id, { summary, self_rate: self_rate||'', submitted_at: new Date().toISOString() })
      const updated = await db.get('scct_reports', found.id)
      return res.json(updated)
    }
    const report = await db.add('scct_reports', { user_id: req.user.id, month, summary, self_rate: self_rate||'', mgr_comment: null, submitted_at: new Date().toISOString() })
    res.json(report)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

router.put('/:id/comment', authenticate, requireRole('manager','director','admin'), async (req, res) => {
  try {
    await db.update('scct_reports', req.params.id, { mgr_comment: req.body.mgr_comment||'' })
    const report = await db.get('scct_reports', req.params.id)
    res.json(report)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
