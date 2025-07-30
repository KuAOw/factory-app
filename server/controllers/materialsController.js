// server/controllers/materialsController.js
const pool = require('../config/db');

exports.getAllMaterials = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM materials');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMaterial = async (req, res) => {
  const { name, unit } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO materials (name, unit) VALUES (?, ?)',
      [name, unit]
    );
    res.status(201).json({ id: result.insertId, name, unit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔍 GET /api/materials/:id
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

// 🔎 GET /api/materials/search?q=...
exports.searchMaterials = async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  try {
    const [rows] = await pool.query('SELECT * FROM materials WHERE name LIKE ?', [q]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✏️ PUT /api/materials/:id
exports.updateMaterial = async (req, res) => {
  const { id } = req.params;
  const { name, unit, image_url, category_id } = req.body;
  try {
    const [result] = await pool.query(
      `UPDATE materials SET name=?, unit=?, image_url=?, category_id=? WHERE id=?`,
      [name, unit, image_url, category_id, id]
    );
    res.json({ updated: result.affectedRows > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// เพิ่ม stock หรือ ลด stock และตรวจสอบไม่ให้ติดลบ
exports.adjustStock = async (req, res) => {
  const { id } = req.params;
  const { diff } = req.body;

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
    const [result] = await pool.query(
      'UPDATE materials SET current_stock = ? WHERE id = ?',
      [newStock, id]
    );

    res.json({ updated: result.affectedRows > 0, newStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ❌ DELETE /api/materials/:id
exports.deleteMaterial = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('DELETE FROM materials WHERE id = ?', [id]);
    res.json({ deleted: result.affectedRows > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
