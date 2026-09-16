const supabase = require('./supabaseClient');
const { generateEmbedding } = require('./embeddingService');

// Builds a consistent text signature from an incident, so similar errors
// produce similar embeddings regardless of minor noise (timestamps, ids, etc.)
function buildErrorSignature(incident) {
  const { error_type, message, stack } = incident;
  const trimmedStack = (stack || '').split('\n').slice(0, 3).join(' ');
  return `${error_type}: ${message} ${trimmedStack}`.trim();
}

async function storeIncidentEmbedding(incident) {
  const signature = buildErrorSignature(incident);
  const embedding = await generateEmbedding(signature);

  const { data, error } = await supabase
    .from('incident_embeddings')
    .insert({
      incident_id: String(incident.id),
      error_signature: signature,
      embedding,
    });

  if (error) {
    console.error('Failed to store incident embedding:', error);
    throw error;
  }

  return data;
}

async function findSimilarIncidents(incident, matchCount = 5) {
  const signature = buildErrorSignature(incident);
  const queryEmbedding = await generateEmbedding(signature);

  const { data, error } = await supabase.rpc('match_incidents', {
    query_embedding: queryEmbedding,
    match_count: matchCount + 1, // fetch one extra to account for the self-match we'll filter out
  });

  if (error) {
    console.error('Similarity search failed:', error);
    throw error;
  }

  const filtered = data.filter(row => row.incident_id !== String(incident.id));

  return filtered.slice(0, matchCount);
}

module.exports = { storeIncidentEmbedding, buildErrorSignature, findSimilarIncidents };