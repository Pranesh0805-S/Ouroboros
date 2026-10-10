const express = require('express');
const router = express.Router();
const {
  createPatch,
  getPatchesForIncident,
  testPatch,
  approvePatch,
  rejectPatch,
  getPatchOriginal,
} = require('../controllers/patches.controller');

router.post('/:id/generate', createPatch);     // :id = incident id
router.post('/:id/test', testPatch);           // :id = PATCH id
router.post('/:id/approve', approvePatch);     // :id = PATCH id
router.post('/:id/reject', rejectPatch);       // :id = PATCH id
router.get('/:id/original', getPatchOriginal); // :id = PATCH id
router.get('/:id', getPatchesForIncident);     // :id = incident id

module.exports = router;