const express = require('express');
const router = express.Router();
const { getMetrics } = require('../controllers/metrics.controller');

router.get('/', getMetrics);

module.exports = router;