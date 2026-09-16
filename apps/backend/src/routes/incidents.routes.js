const express = require('express');
const router = express.Router();
const { ingestIncident, getAllIncidents, getSimilarIncidents } = require('../controllers/incidents.controller');

router.post('/ingest', ingestIncident);
router.get('/', getAllIncidents);
router.get('/:id/similar', getSimilarIncidents);

module.exports = router;