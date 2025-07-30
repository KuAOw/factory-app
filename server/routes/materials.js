// server/routes/materials.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/materialsController');

router.get('/', controller.getAllMaterials);
router.post('/', controller.createMaterial);

module.exports = router;
