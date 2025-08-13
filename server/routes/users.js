const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const { auth, allow } = require('../middleware/auth');

// ---------- Auth ----------
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);

// ---------- Self ----------
router.get('/me', auth, ctrl.me);
router.patch('/me', auth, ctrl.updateMe);

// ---------- Admin/Owner ----------
router.get('/', auth, ctrl.list);
router.get('/:id', auth, ctrl.getById);
router.post('/', auth, ctrl.validateCreate, ctrl.create);
router.patch('/:id', auth, ctrl.validateUpdate, ctrl.update);
router.delete('/:id', auth, ctrl.remove);

module.exports = router;
