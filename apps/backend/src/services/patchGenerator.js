const Anthropic = require('@anthropic-ai/sdk');
const { getSourceFileForIncident } = require('./codeContext');
const { findSimilarIncidents } = require('./incidentEmbedding');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt({ incident, sourceCode, relativePath, similarIncidents }) {
  const similarSection = similarIncidents.length
    ? similarIncidents
        .map((s, i) => `${i + 1}. (similarity ${s.similarity.toFixed(3)}) ${s.error_signature}`)
        .join('\n')
    : 'None found.';

  return `You are an automated code-repair system. Given a bug report and the exact source file, generate a minimal, correct patch.

BUG REPORT
Error type: ${incident.error_type}
Classified as: ${incident.classified_type}
Message: ${incident.message}
Stack: ${incident.stack || 'N/A'}

SIMILAR PAST INCIDENTS (for context only, do not copy blindly)
${similarSection}

SOURCE FILE: ${relativePath}
\`\`\`javascript
${sourceCode}
\`\`\`

Respond with ONLY valid JSON, no markdown fences, no prose outside the JSON, in this exact shape:
{
  "explanation": "one or two sentences on what was wrong and how this fixes it",
  "confidence_score": 0.0 to 1.0,
  "patched_code": "the FULL corrected file contents, not just the changed lines"
}`;
}

// Claude sometimes wraps JSON in ```json fences despite instructions not to.
// Strip them defensively rather than assume strict compliance.
function extractJson(rawText) {
  let cleaned = rawText.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '').replace(/```\s*$/, '');
  }

  return cleaned.trim();
}

async function generatePatch(incident) {
  const { relativePath, code } = getSourceFileForIncident(incident);
  const similarIncidents = await findSimilarIncidents(incident, 3);

  const prompt = buildPrompt({ incident, sourceCode: code, relativePath, similarIncidents });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = response.content[0].text;
  const cleaned = extractJson(rawText);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Failed to parse LLM response as JSON: ${cleaned.slice(0, 300)}`);
  }

  return {
    target_file: relativePath,
    generated_diff: parsed.patched_code,
    explanation: parsed.explanation,
    confidence_score: parsed.confidence_score,
  };
}

module.exports = { generatePatch };