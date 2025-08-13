// ใช้ bcrypt สำหรับ hashing password
const bcrypt = require('bcrypt');
// ใช้ jsonwebtoken สำหรับสร้าง/ตรวจสอบ JWT token
const jwt = require('jsonwebtoken');
// ใช้ express-validator สำหรับตรวจสอบและ validate input
const { body, validationResult } = require('express-validator');
// ใช้ mysql2 pool เพื่อเชื่อมต่อฐานข้อมูล
const pool = require('../config/db'); 

// Helper function สำหรับแปลงข้อมูล user จาก DB ให้เป็นรูปแบบที่ส่งไปยัง client
const fmtUser = u => ({
  id: u.id, name: u.name, email: u.email,
  role_int: u.role_int, 
  is_active: !!u.is_active, // แปลงเป็น boolean
  last_login: u.last_login, 
  created_at: u.created_at, 
  updated_at: u.updated_at,
  description: u.description, 
  img: u.img
});

// ---------- Validators ----------
// กำหนด validation rules สำหรับการสร้าง user ใหม่
exports.validateCreate = [
  body('name').trim().notEmpty(), // ต้องมี name
  body('email').isEmail(), // ต้องเป็น email ที่ถูกต้อง
  body('password').isLength({ min: 8 }), // password ต้อง >= 8 ตัว
  body('role_int').isInt({ min:1, max:5 }) // role ต้องเป็นตัวเลข 1-5
];

// กำหนด validation rules สำหรับการแก้ไข user
exports.validateUpdate = [
  body('name').optional().trim().notEmpty(),
  body('email').optional().isEmail(),
  body('password').optional().isLength({ min: 8 }),
  body('role_int').optional().isInt({ min:1, max:5 }),
  body('is_active').optional().isBoolean()
];

// ---------- Token Helpers ----------
// สร้าง access token (สั้นอายุ เช่น 15 นาที)
function signAccess(u) {
  return jwt.sign(
    { id: u.id, role_int: u.role_int, name: u.name, email: u.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}
// สร้าง refresh token (อายุยาว เช่น 7 วัน)
function signRefresh(u) {
  return jwt.sign(
    { id: u.id, role_int: u.role_int },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

// ---------- Auth (การเข้าสู่ระบบและ token) ----------
// API เข้าสู่ระบบ
exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  // ดึงข้อมูล user จาก email
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  const user = rows[0];
  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  // ตรวจสอบรหัสผ่านด้วย bcrypt
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  // อัปเดต last_login
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

  // สร้าง access_token และ refresh_token
  const access_token = signAccess(user);
  const refresh_token = signRefresh(user);
  return res.json({ access_token, refresh_token, user: fmtUser(user) });
};

// API สำหรับ refresh token
exports.refresh = async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    // ตรวจสอบ refresh token
    const payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [payload.id]);
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid refresh token' });

    // สร้าง token ใหม่ (rotation)
    const access_token = signAccess(user);
    const new_refresh_token = signRefresh(user);
    return res.json({ access_token, refresh_token: new_refresh_token });
  } catch {
    return res.status(401).json({ error: 'Invalid/Expired refresh token' });
  }
};

// API แสดงข้อมูล user ของ token ปัจจุบัน
exports.me = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  const me = rows[0];
  if (!me) return res.status(404).json({ error: 'Not found' });
  res.json(fmtUser(me));
};

// API ให้ผู้ใช้แก้ไขข้อมูลตัวเอง
exports.updateMe = async (req, res) => {
  const { name, email, password, img, description } = req.body || {};
  const patches = [];
  const params = [];

  if (name) { patches.push('name=?'); params.push(name); }
  if (email) { patches.push('email=?'); params.push(email); }
  if (img) { patches.push('img=?'); params.push(img); }
  if (description) { patches.push('description=?'); params.push(description); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    patches.push('password_hash=?'); params.push(hash);
  }

  if (!patches.length) return res.status(400).json({ error: 'Nothing to update' });
  params.push(req.user.id);

  // อัปเดตข้อมูล + timestamp
  await pool.query(`UPDATE users SET ${patches.join(', ')}, updated_at=NOW() WHERE id=?`, params);
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
  res.json(fmtUser(rows[0]));
};

// ---------- Admin/Owner operations ----------
const { canManageUser } = require('../middleware/auth');

// API list user ทั้งหมด (สิทธิ์ตาม role)
// role 4 (storekeeper) เห็นเฉพาะฟิลด์สำคัญ
exports.list = async (req, res) => {
  if (req.user.role_int === 4) {
    const [rows] = await pool.query('SELECT id, name, email, role_int, is_active, img FROM users ORDER BY id');
    return res.json(rows);
  }
  // role 1 (owner) และ role 2 (admin) เห็นทั้งหมด
  if ([1,2].includes(req.user.role_int)) {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY id');
    return res.json(rows.map(fmtUser));
  }
  // role อื่นๆ ไม่มีสิทธิ์
  return res.status(403).json({ error: 'Forbidden' });
};

// API ดึงข้อมูลผู้ใช้ตาม id
exports.getById = async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  const u = rows[0];
  if (!u) return res.status(404).json({ error: 'Not found' });

  // ตรวจสอบสิทธิ์การเข้าถึง
  if (!canManageUser(req.user, u) && req.user.role_int !== 4) {
    // storekeepers เห็นเฉพาะฟิลด์สั้น
    if (req.user.role_int === 4) {
      const short = (({ id,name,email,role_int,is_active,img }) => ({ id,name,email,role_int,is_active,img }))(u);
      return res.json(short);
    }
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(fmtUser(u));
};

// API สร้างผู้ใช้ใหม่
exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  // เฉพาะ owner(1) และ admin(2) เท่านั้น
  if (![1,2].includes(req.user.role_int)) return res.status(403).json({ error: 'Forbidden' });

  const { name, email, password, role_int, is_active = true, img, description } = req.body;
  if (req.user.role_int === 2 && role_int === 1) {
    return res.status(403).json({ error: 'Admin cannot create owner' });
  }

  // hash password
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    'INSERT INTO users (name, email, password_hash, role_int, is_active, img, description) VALUES (?,?,?,?,?,?,?)',
    [name, email, hash, role_int, is_active ? 1 : 0, img || null, description || null]
  );
  const [rows] = await pool.query('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
  res.status(201).json(fmtUser(rows[0]));
};

// API อัปเดตข้อมูลผู้ใช้ (admin/owner เท่านั้น)
exports.update = async (req, res) => {
  const id = Number(req.params.id);
  const [rows0] = await pool.query('SELECT * FROM users WHERE id=? LIMIT 1', [id]);
  const target = rows0[0];
  if (!target) return res.status(404).json({ error: 'Not found' });

  if (!canManageUser(req.user, target)) return res.status(403).json({ error: 'Forbidden' });

  const { name, email, password, role_int, is_active, img, description } = req.body || {};
  const patches = [], params = [];

  // อัปเดตเฉพาะฟิลด์ที่ส่งมา
  if (name !== undefined) { patches.push('name=?'); params.push(name); }
  if (email !== undefined) { patches.push('email=?'); params.push(email); }
  if (img !== undefined) { patches.push('img=?'); params.push(img); }
  if (description !== undefined) { patches.push('description=?'); params.push(description); }
  if (role_int !== undefined) {
    // admin ห้ามแก้ owner
    if (req.user.role_int === 2 && target.role_int === 1) {
      return res.status(403).json({ error: 'Admin cannot modify owner' });
    }
    // เฉพาะ owner/admin เปลี่ยน role ได้
    if (![1,2].includes(req.user.role_int)) return res.status(403).json({ error: 'Only owner/admin can change roles' });
    patches.push('role_int=?'); params.push(role_int);
  }
  if (is_active !== undefined) {
    // เฉพาะ owner/admin เปิด/ปิดการใช้งานได้
    if (![1,2].includes(req.user.role_int)) return res.status(403).json({ error: 'Only owner/admin can activate/deactivate' });
    patches.push('is_active=?'); params.push(is_active ? 1 : 0);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    patches.push('password_hash=?'); params.push(hash);
  }
  if (!patches.length) return res.status(400).json({ error: 'Nothing to update' });

  params.push(id);
  await pool.query(`UPDATE users SET ${patches.join(', ')}, updated_at=NOW() WHERE id=?`, params);

  const [rows] = await pool.query('SELECT * FROM users WHERE id=?', [id]);
  res.json(fmtUser(rows[0]));
};

// API ลบผู้ใช้
exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  const [rows0] = await pool.query('SELECT * FROM users WHERE id=? LIMIT 1', [id]);
  const target = rows0[0];
  if (!target) return res.sendStatus(204);

  if (!canManageUser(req.user, target)) return res.status(403).json({ error: 'Forbidden' });

  // ป้องกันลบ owner คนสุดท้าย
  if (target.role_int === 1) {
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) AS cnt FROM users WHERE role_int=1');
    if (cnt <= 1) return res.status(409).json({ error: 'Cannot delete the last owner' });
  }

  await pool.query('DELETE FROM users WHERE id=?', [id]);
  return res.sendStatus(204);
};
