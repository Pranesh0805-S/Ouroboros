const express = require('express');
const router = express.Router();
const { ingestIncident, getAllIncidents } = require('../controllers/incidents.controller');

router.post('/ingest', ingestIncident);
router.get('/', getAllIncidents);

module.exports = router;