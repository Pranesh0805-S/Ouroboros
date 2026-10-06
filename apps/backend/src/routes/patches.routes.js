const express = require('express');
const router = express.Router();
const { createPatch, getPatchesForIncident, testPatch } = require('../controllers/patches.controller');

router.post('/:id/generate', createPatch);   // :id = incident id
router.post('/:id/test', testPatch);         // :id = PATCH id
router.get('/:id', getPatchesForIncident);   // :id = incident id

module.exports = router;