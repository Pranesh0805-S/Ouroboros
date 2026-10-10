const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config();

const connectDB = require('../src/config/db');
const Incident = require('../src/models/Incident.model');
const supabase = require('../src/services/supabaseClient');
const { storeIncidentEmbedding } = require('../src/services/incidentEmbedding');

(async () => {
  await connectDB();

  const { data, error } = await supabase.from('incident_embeddings').select('incident_id');
  if (error) throw error;
  const have = new Set(data.map((r) => r.incident_id));

  const incidents = await Incident.find();
  let added = 0;
  for (const inc of incidents) {
    if (have.has(String(inc.id))) continue;
    await storeIncidentEmbedding(inc);
    added++;
    console.log(`stored embedding for ${inc.id} (${inc.error_type})`);
  }
  console.log(`Done. Added ${added}, already had ${incidents.length - added}.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
