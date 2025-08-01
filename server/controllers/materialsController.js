// server/controllers/materialsController.js
const pool = require('../config/db');

//---------------------------------------------------------✉️ GET /api/materials
exports.getAllMaterials = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM materials');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//---------------------------------------------------------✉️ POST /api/materials
exports.createMaterial = async (req, res) => {
  const { name, unit, min_stock = 0 } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO materials (name, unit, min_stock) VALUES (?, ?, ?)',
      [name, unit, min_stock]
    );
    res.status(201).json({ id: result.insertId, name, unit, min_stock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//---------------------------------------------------------🔍 GET /api/materials/:id
exports.getMaterialById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Material not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//---------------------------------------------------------🔎 GET /api/materials/search?q=...
exports.searchMaterials = async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  try {
    const [rows] = await pool.query('SELECT * FROM materials WHERE name LIKE ?', [q]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//---------------------------------------------------------✏️ PUT /api/materials/:id
exports.updateMaterial = async (req, res) => {
  const { id } = req.params;
  const { name, unit, image_url, category_id, min_stock } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE materials SET name=?, unit=?, image_url=?, category_id=?, min_stock=? WHERE id=?`,
      [name, unit, image_url, category_id, min_stock, id]
    );
    res.json({ updated: result.affectedRows > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//---------------------------------------------------------เพิ่ม stock หรือ ลด stock, ตรวจสอบไม่ให้ติดลบ, บันทึก log
exports.adjustStock = async (req, res) => {
  const { id } = req.params;
  const { diff, user_id, reason = 'manual adjustment' } = req.body;

  try {
    // 1. ดึง stock ปัจจุบัน
    const [[material]] = await pool.query('SELECT current_stock FROM materials WHERE id = ?', [id]);
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const newStock = material.current_stock + diff;

    // 2. ตรวจสอบไม่ให้ติดลบ
    if (newStock < 0) {
      return res.status(400).json({ error: 'Stock quantity is insufficient' });
    }

    // 3. อัปเดต stock
    await pool.query('UPDATE materials SET current_stock = ? WHERE id = ?', [newStock, id]);

    // 4. บันทึก log
    await pool.query(
      `INSERT INTO material_logs (material_id, qty, action, reason, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [id, Math.abs(diff), diff > 0 ? 'in' : 'out', reason, user_id]
    );

    res.json({ updated: true, newStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



//--------------------------------------------------------- ❌ DELETE /api/materials/:id
exports.deleteMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    res.json({ deleted: result.affectedRows > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//---------------------------------------------------------controller/materialsController.js
exports.getLowStockMaterials = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM materials WHERE current_stock < min_stock'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//---------------------------------------------------------ระบบรับวัสดุเข้า (Receive Materials)
// 🔧 ฟังก์ชันสำหรับสร้าง batch code
async function generateBatchCode(material_id, conn) {
  const db = conn || pool;

  const [[{ count }]] = await db.query(
    `SELECT COUNT(*) AS count FROM material_batches WHERE material_id = ?`,
    [material_id]
  );

  const materialPart = material_id.toString().padStart(4, '0');
  const countPart = (count + 1).toString().padStart(4, '0');

  return `RM${materialPart}${countPart}`;
}

// 📦 API สำหรับรับวัสดุเข้า
exports.receiveMaterial = async (req, res) => {
  const {
    material_id,
    purchase_price,
    vat_applicable = 0,
    vat_rate = null,
    qty_received,
    supplier_name,
    user_id
  } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 🔄 1. Generate batch code
    const batch_code = await generateBatchCode(material_id, conn);

    // 🧾 2. เพิ่มเข้า material_batches
    const [batchResult] = await conn.query(
      `INSERT INTO material_batches 
        (material_id, batch_code, purchase_price, vat_applicable, vat_rate, 
         qty_received, qty_remaining, supplier_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        material_id,
        batch_code,
        purchase_price,
        vat_applicable,
        vat_rate,
        qty_received,
        qty_received,
        supplier_name
      ]
    );

    const batch_id = batchResult.insertId;

    // 📝 3. เพิ่ม log
    await conn.query(
      `INSERT INTO material_logs 
       (material_id, batch_id, qty, action, reason, user_id, note) 
       VALUES (?, ?, ?, 'in', ?, ?, ?)`,
      [material_id, batch_id, qty_received, 'รับวัสดุเข้า', user_id, supplier_name]
    );

    // 📦 4. อัปเดต stock
    await conn.query(
      `UPDATE materials SET current_stock = current_stock + ? WHERE id = ?`,
      [qty_received, material_id]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'วัสดุถูกบันทึกเข้าเรียบร้อยแล้ว',
      batch_code,
      batch_id
    });

  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
};


//--------------------------------------------------------- 🔎 Advanced filter
exports.filterMaterials = async (req, res) => {
  const { q, category, in_stock } = req.query;

  // เตรียม SQL และ params
  let sql = 'SELECT * FROM materials WHERE 1=1';
  const params = [];

  // ค้นหาชื่อวัสดุ
  if (q) {
    sql += ' AND name LIKE ?';
    params.push(`%${q}%`);
  }

  // ค้นหาตามหมวดหมู่
  if (category) {
    sql += ' AND category_id = ?';
    params.push(category);
  }

  // ค้นหาเฉพาะที่มี stock
  if (in_stock === 'true') {
    sql += ' AND current_stock > 0';
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


//---------------------------------------------------------ดึง log ของวัสดุมาแสดง
// controller/materialsController.js
exports.getMaterialLogs = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT 
         l.id,
         l.qty,
         l.action,
         l.reason,
         l.note,
         l.timestamp,
         b.batch_code,
         u.name AS user_name
       FROM material_logs l
       LEFT JOIN material_batches b ON l.batch_id = b.id
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.material_id = ?
       ORDER BY l.timestamp DESC`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
