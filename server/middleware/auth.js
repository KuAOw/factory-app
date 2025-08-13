const jwt = require('jsonwebtoken');

exports.auth = (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { id, role_int, name, email }
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid/Expired token' });
  }
};

exports.allow = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (roles.includes(req.user.role_int)) return next();
  return res.status(403).json({ error: 'Forbidden' });
};

// Helper: ตรวจสิทธิ์เชิงตรรกะสำหรับ action บน user เป้าหมาย
exports.canManageUser = (actor, target) => {
  if (!actor) return false;
  if (actor.role_int === 1) return true;               // owner ทำได้หมด
  if (actor.role_int === 2) {                           // admin ห้ามยุ่งกับ owner
    return target.role_int !== 1;
  }
  // อื่นๆ แก้ไขได้เฉพาะตัวเอง
  return actor.id === target.id;
};
