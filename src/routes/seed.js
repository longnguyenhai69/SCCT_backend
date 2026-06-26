const router = require('express').Router()
const bcrypt = require('bcryptjs')
const db     = require('../firestore')

router.get('/', async (req, res) => {
  try {
    const hash = await bcrypt.hash('scct@2026', 10)
    const now  = new Date().toISOString()

    // Users
    const u1 = await db.add('scct_users', { name:'Quản trị viên', email:'admin@scct.vn', password_hash:hash, role:'admin', created_at:now })
    const u2 = await db.add('scct_users', { name:'Nguyễn Văn An',  email:'an@scct.vn',    password_hash:hash, role:'tech', created_at:now })
    const u3 = await db.add('scct_users', { name:'Trần Thị Bình',  email:'binh@scct.vn',  password_hash:hash, role:'tech', created_at:now })
    const u4 = await db.add('scct_users', { name:'Lê Minh Cường',  email:'cuong@scct.vn', password_hash:hash, role:'manager', created_at:now })
    const u5 = await db.add('scct_users', { name:'Phạm Quốc Dũng', email:'dung@scct.vn',  password_hash:hash, role:'director', created_at:now })

    // Sites
    const s1 = await db.add('scct_sites', { name:'Cảng Sài Gòn',           loc:'Quận 4, TP.HCM', type:'Phương tiện thủy', reg_no:'SG-2024-001', inspect_expiry:'2026-06-26', created_at:now })
    const s2 = await db.add('scct_sites', { name:'Công trường Nhơn Trạch', loc:'Đồng Nai',        type:'Bốc xúc',          reg_no:null,          inspect_expiry:null,         created_at:now })
    const s3 = await db.add('scct_sites', { name:'Cảng Cát Lái',           loc:'Quận 2, TP.HCM', type:'Phương tiện thủy', reg_no:'CL-2024-003', inspect_expiry:'2026-09-15', created_at:now })

    // Devices
    const d1 = await db.add('scct_devices', { name:'Cần cẩu 1',     type:'Cần cẩu',   status:'normal', site_id:s1.id, assigned_to:u2.id, reg_no:null,      inspect_expiry:null,         description:'Cần cẩu tháp 50 tấn, năm SX 2019', created_at:now })
    const d2 = await db.add('scct_devices', { name:'Máy bơm A',     type:'Máy bơm',   status:'normal', site_id:s1.id, assigned_to:u2.id, reg_no:null,      inspect_expiry:null,         description:'Bơm li tâm 200m3/h', created_at:now })
    const d3 = await db.add('scct_devices', { name:'Máy xúc 01',    type:'Máy xúc',   status:'normal', site_id:s2.id, assigned_to:u3.id, reg_no:'MX-001', inspect_expiry:'2026-12-31', description:'Komatsu PC200-8, 20 tấn', created_at:now })
    const d4 = await db.add('scct_devices', { name:'Máy khoan 3',   type:'Máy khoan', status:'normal', site_id:s2.id, assigned_to:u3.id, reg_no:'MK-003', inspect_expiry:'2026-07-10', description:'Máy khoan thủy lực Atlas', created_at:now })
    const d5 = await db.add('scct_devices', { name:'Cần cẩu nổi 2', type:'Cần cẩu',   status:'normal', site_id:s3.id, assigned_to:u2.id, reg_no:null,      inspect_expiry:null,         description:'Cần cẩu nổi 80 tấn', created_at:now })

    // Tickets
    const t1 = await db.add('scct_tickets', { device_id:d4.id, site_id:s2.id, user_id:u2.id, status:'in_progress', description:'Máy khoan rung bất thường, nghi ngờ bạc đạn bị mòn', plan:'Kiểm tra và thay bạc đạn trục chính', due_date:'2026-07-05', other_label:'', approved_plan:'Dừng máy, tháo kiểm tra, thay bạc đạn nếu cần', approved_by:u4.id, approved_date:'2026-06-25', resolved_date:null, resolve_note:null, assignee_ids:[u2.id], incident_time:null, operating_hours:null, operator:'', initial_cause:'', created_at:'2026-06-24T08:30:00.000Z' })
    const t2 = await db.add('scct_tickets', { device_id:d3.id, site_id:s2.id, user_id:u3.id, status:'pending',     description:'Dầu thủy lực rò rỉ tại khớp nối số 3',              plan:'Thay gioăng và siết lại đầu nối',     due_date:'2026-07-03', other_label:'', approved_plan:null, approved_by:null, approved_date:null,        resolved_date:null, resolve_note:null, assignee_ids:[u3.id], incident_time:null, operating_hours:null, operator:'', initial_cause:'', created_at:'2026-06-27T14:20:00.000Z' })
    const t3 = await db.add('scct_tickets', { device_id:d1.id, site_id:s1.id, user_id:u2.id, status:'resolved',    description:'Puly cáp bị kẹt không quay',                          plan:'Tra dầu và vệ sinh cơ cấu quay',      due_date:'2026-06-20', other_label:'', approved_plan:'Tra dầu mỡ, kiểm tra ổ đỡ, vệ sinh', approved_by:u4.id, approved_date:'2026-06-18', resolved_date:'2026-06-19', resolve_note:'Đã tra dầu và vệ sinh xong, cần cẩu hoạt động bình thường', assignee_ids:[u2.id], incident_time:null, operating_hours:null, operator:'', initial_cause:'', created_at:'2026-06-17T09:00:00.000Z' })

    // Ticket update
    await db.add('scct_ticket_updates', { ticket_id:t1.id, user_id:u2.id, note:'Đã tháo kiểm tra, xác nhận bạc đạn trục chính mòn nặng. Đặt linh kiện thay thế.', created_at:'2026-06-25T16:00:00.000Z' })

    // Report
    await db.add('scct_reports', { user_id:u2.id, month:'2026-06', summary:'Tháng 6 đã xử lý 2 sự cố tại công trường Nhơn Trạch và Cảng Sài Gòn. Kiểm tra định kỳ 5 thiết bị.', self_rate:'Hoàn thành 80% công việc được giao, còn 1 phiếu sự cố đang xử lý.', mgr_comment:null, submitted_at:now })

    res.json({ message: 'Seed data thành công!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

module.exports = router
