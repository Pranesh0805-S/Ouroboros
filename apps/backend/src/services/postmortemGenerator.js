const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(incident, patch) {
  const attempts = (patch.attempts || [])
    .map((a) => `- Attempt ${a.attempt}: ${a.test_result} (${a.pass ?? '?'} passed, ${a.fail ?? '?'} failed) - ${a.explanation || 'no explanation'}`)
    .join('\n') || '- Single patch, no retry history recorded.';

  return `Write a short, plain-English incident postmortem in Markdown. Use only the facts below; do not invent details.

INCIDENT
Type: ${incident.error_type} (classified as ${incident.classified_type})
Route: ${incident.route || 'unknown'}
Message: ${incident.message}
Detected: ${incident.createdAt}

PATCH
Target file: ${patch.target_file}
Explanation: ${patch.explanation || 'none'}
Confidence: ${patch.confidence_score ?? 'n/a'}

GENERATION ATTEMPTS
${attempts}

REVIEW AND OUTCOME
Sandbox result: ${patch.test_result}
Human approval: ${patch.approval_status}${patch.review_note ? ` (note: ${patch.review_note})` : ''}
Applied to local sample app: ${patch.deployed}
Final outcome: ${patch.outcome}
Outcome check: ${patch.outcome_check?.status || 'not run'}

RULES
The fix was applied to a local sample app and verified only by re-running its test suite. Never say it ran in production or was monitored. Describe the fix as "according to the patch explanation" and do not claim more than the tests verify.

Use exactly these sections: Summary, Impact, Root cause, Fix, Verification, Follow-ups. Keep each section to 1-3 sentences. Under Follow-ups, suggest one concrete way to strengthen the tests or monitoring.`;
}

async function generatePostmortem(incident, patch) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1200,
    messages: [{ role: 'user', content: buildPrompt(incident, patch) }],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block) throw new Error('LLM returned no text.');
  return block.text.trim();
}

module.exports = { generatePostmortem };