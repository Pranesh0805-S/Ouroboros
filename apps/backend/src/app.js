const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const incidentsRoutes = require('./routes/incidents.routes');
const patchesRoutes = require('./routes/patches.routes');
const metricsRoutes = require('./routes/metrics.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/incidents', incidentsRoutes);
app.use('/api/patches', patchesRoutes);
app.use('/api/metrics', metricsRoutes);

module.exports = app;