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
