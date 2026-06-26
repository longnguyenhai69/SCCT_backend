-- ============================================================
-- SCCT - Quản lý thiết bị cơ điện — Database Schema
-- ============================================================

-- Xoá bảng cũ (theo thứ tự dependency)
DROP TABLE IF EXISTS reports        CASCADE;
DROP TABLE IF EXISTS ticket_updates CASCADE;
DROP TABLE IF EXISTS ticket_assignees CASCADE;
DROP TABLE IF EXISTS tickets        CASCADE;
DROP TABLE IF EXISTS devices        CASCADE;
DROP TABLE IF EXISTS sites          CASCADE;
DROP TABLE IF EXISTS users          CASCADE;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'tech',
  -- role: tech | specialist | deputy_manager | manager | director | admin
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── SITES ────────────────────────────────────────────────────
CREATE TABLE sites (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  loc            VARCHAR(255),
  type           VARCHAR(100),   -- 'Phương tiện thủy' | 'Bốc xúc'
  reg_no         VARCHAR(100),   -- chỉ cho 'Phương tiện thủy'
  inspect_expiry DATE,           -- chỉ cho 'Phương tiện thủy'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEVICES ──────────────────────────────────────────────────
CREATE TABLE devices (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(255) NOT NULL,
  type           VARCHAR(100),
  status         VARCHAR(50) DEFAULT 'normal', -- normal | maintain | pending
  site_id        INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  assigned_to    INTEGER REFERENCES users(id)  ON DELETE SET NULL,
  reg_no         VARCHAR(100),   -- không dùng nếu site là 'Phương tiện thủy'
  inspect_expiry DATE,           -- không dùng nếu site là 'Phương tiện thủy'
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── TICKETS ──────────────────────────────────────────────────
CREATE TABLE tickets (
  id             SERIAL PRIMARY KEY,
  device_id      INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  site_id        INTEGER REFERENCES sites(id)   ON DELETE SET NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  status         VARCHAR(50) DEFAULT 'pending', -- pending | in_progress | resolved
  description    TEXT NOT NULL,
  plan           TEXT,
  due_date       DATE,
  other_label    VARCHAR(255),  -- khi không phải thiết bị cụ thể
  approved_plan  TEXT,
  approved_by    INTEGER REFERENCES users(id),
  approved_date  DATE,
  resolved_date  DATE,
  resolve_note   TEXT,
  incident_time  TIMESTAMPTZ,
  operating_hours INTEGER,
  operator       VARCHAR(255),
  initial_cause  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── TICKET ASSIGNEES (nhiều nhân viên / 1 phiếu) ─────────────
CREATE TABLE ticket_assignees (
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, user_id)
);

-- ── TICKET UPDATES (nhật ký tiến độ) ─────────────────────────
CREATE TABLE ticket_updates (
  id         SERIAL PRIMARY KEY,
  ticket_id  INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  note       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MONTHLY REPORTS ───────────────────────────────────────────
CREATE TABLE reports (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id),
  month        CHAR(7) NOT NULL,  -- 'YYYY-MM'
  summary      TEXT,
  self_rate    TEXT,
  mgr_comment  TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, month)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Mật khẩu mặc định: 'scct@2026' (bcrypt hash)
INSERT INTO users (name, email, password_hash, role) VALUES
  ('Quản trị viên',       'admin@scct.vn',   '$2a$10$OXJXluGYh1BDtuzvvxIuXO7qWYFz.n.uWQBgtmE9QO5AHZtCevCJ2', 'admin'),
  ('Nguyễn Văn An',       'an@scct.vn',      '$2a$10$OXJXluGYh1BDtuzvvxIuXO7qWYFz.n.uWQBgtmE9QO5AHZtCevCJ2', 'tech'),
  ('Trần Thị Bình',       'binh@scct.vn',    '$2a$10$OXJXluGYh1BDtuzvvxIuXO7qWYFz.n.uWQBgtmE9QO5AHZtCevCJ2', 'tech'),
  ('Lê Minh Cường',       'cuong@scct.vn',   '$2a$10$OXJXluGYh1BDtuzvvxIuXO7qWYFz.n.uWQBgtmE9QO5AHZtCevCJ2', 'manager'),
  ('Phạm Quốc Dũng',      'dung@scct.vn',    '$2a$10$OXJXluGYh1BDtuzvvxIuXO7qWYFz.n.uWQBgtmE9QO5AHZtCevCJ2', 'director');

-- Sites
INSERT INTO sites (name, loc, type, reg_no, inspect_expiry) VALUES
  ('Cảng Sài Gòn',        'Quận 4, TP.HCM',   'Phương tiện thủy', 'SG-2024-001', '2026-06-26'),
  ('Công trường Nhơn Trạch', 'Đồng Nai',       'Bốc xúc',          NULL,           NULL),
  ('Cảng Cát Lái',        'Quận 2, TP.HCM',   'Phương tiện thủy', 'CL-2024-003', '2026-09-15');

-- Devices (assigned_to references user id 2=An, 3=Bình)
INSERT INTO devices (name, type, status, site_id, assigned_to, reg_no, inspect_expiry, description) VALUES
  ('Cần cẩu 1',     'Cần cẩu',    'normal',  1, 2, NULL, NULL, 'Cần cẩu tháp 50 tấn, năm SX 2019'),
  ('Máy bơm A',     'Máy bơm',    'normal',  1, 2, NULL, NULL, 'Bơm li tâm 200m3/h'),
  ('Máy xúc 01',    'Máy xúc',    'normal',  2, 3, 'MX-001', '2026-12-31', 'Komatsu PC200-8, 20 tấn'),
  ('Máy khoan 3',   'Máy khoan',  'normal',  2, 3, 'MK-003', '2026-07-10', 'Máy khoan thủy lực Atlas'),
  ('Cần cẩu nổi 2', 'Cần cẩu',   'normal',  3, 2, NULL, NULL, 'Cần cẩu nổi 80 tấn');

-- Tickets
INSERT INTO tickets (device_id, site_id, user_id, status, description, plan, due_date, approved_plan, approved_by, approved_date, resolved_date, resolve_note, created_at) VALUES
  (4, 2, 2, 'in_progress',
   'Máy khoan rung bất thường, nghi ngờ bạc đạn bị mòn',
   'Kiểm tra và thay bạc đạn trục chính',
   '2026-07-05',
   'Dừng máy, tháo kiểm tra, thay bạc đạn nếu cần',
   4, '2026-06-25',
   NULL, NULL,
   '2026-06-24 08:30:00'),
  (3, 2, 3, 'pending',
   'Dầu thủy lực rò rỉ tại khớp nối số 3',
   'Thay gioăng và siết lại đầu nối',
   '2026-07-03',
   NULL, NULL, NULL, NULL, NULL,
   '2026-06-27 14:20:00'),
  (1, 1, 2, 'resolved',
   'Puly cáp bị kẹt không quay',
   'Tra dầu và vệ sinh cơ cấu quay',
   '2026-06-20',
   'Tra dầu mỡ, kiểm tra ổ đỡ, vệ sinh',
   4, '2026-06-18',
   '2026-06-19', 'Đã tra dầu và vệ sinh xong, cần cẩu hoạt động bình thường',
   '2026-06-17 09:00:00');

-- Ticket assignees
INSERT INTO ticket_assignees (ticket_id, user_id) VALUES (1, 2), (2, 3);

-- Ticket update
INSERT INTO ticket_updates (ticket_id, user_id, note, created_at) VALUES
  (1, 2, 'Đã tháo kiểm tra, xác nhận bạc đạn trục chính mòn nặng. Đặt linh kiện thay thế.', '2026-06-25 16:00:00');

-- Report
INSERT INTO reports (user_id, month, summary, self_rate, submitted_at) VALUES
  (2, '2026-06', 'Tháng 6 đã xử lý 2 sự cố tại công trường Nhơn Trạch và Cảng Sài Gòn. Kiểm tra định kỳ 5 thiết bị.', 'Hoàn thành 80% công việc được giao, còn 1 phiếu sự cố đang xử lý.', '2026-06-27 10:00:00');
