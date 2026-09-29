const express = require('express');
const router = express.Router();
const { createPatch, getPatchesForIncident } = require('../controllers/patches.controller');

router.post('/:id/generate', createPatch);
router.get('/:id', getPatchesForIncident);

module.exports = router;