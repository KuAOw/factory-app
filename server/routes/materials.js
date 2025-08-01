// server/routes/materials.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/materialsController');

// Define routes for materials
router.get('/', controller.getAllMaterials); // ดึงวัสดุทั้งหมด
router.get('/search', controller.searchMaterials); // ค้นหาวัสดุตามชื่อ
router.get('/lowstock', controller.getLowStockMaterials); // ดึงวัสดุที่มีสต็อกต่ำกว่าค่าที่กำหนด
router.post('/receive', controller.receiveMaterial); // รับวัสดุเข้า
router.get('/filter', controller.filterMaterials); // filter materials
router.get('/:id/logs', controller.getMaterialLogs); //ดึง logs ของวัสดุ
router.get('/:id', controller.getMaterialById); // ดึงวัสดุตาม ID
router.post('/', controller.createMaterial); // สร้างวัสดุใหม่
router.put('/:id', controller.updateMaterial); // อัปเดตวัสดุตาม ID
router.patch('/adjust/:id', controller.adjustStock); // ปรับสต็อกวัสดุ
router.delete('/:id', controller.deleteMaterial); // ลบวัสดุตาม ID




module.exports = router;
