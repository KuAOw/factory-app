// server/routes/materials.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/materialsController');

// Define routes for materials
router.get('/', controller.getAllMaterials);
router.get('/search', controller.searchMaterials);
router.get('/:id', controller.getMaterialById);
router.post('/', controller.createMaterial);
router.put('/:id', controller.updateMaterial);
router.patch('/adjust/:id', controller.adjustStock);
router.delete('/:id', controller.deleteMaterial);


module.exports = router;
