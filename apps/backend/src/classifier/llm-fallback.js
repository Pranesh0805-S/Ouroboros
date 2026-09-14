const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VALID_LABELS = ['null_pointer', 'memory_leak', 'rate_limit', 'off_by_one'];

async function classifyByLLM(incident) {
  const prompt = `You are an error classification system for a CI/CD pipeline. Classify the following error into exactly ONE of these categories: null_pointer, memory_leak, rate_limit, off_by_one, or unknown (if it doesn't clearly fit any of these).

Error message: ${incident.message}
Stack trace: ${incident.stack || 'N/A'}
Route: ${incident.route || 'N/A'}

Respond with ONLY the category label, nothing else. No explanation, no punctuation.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 20,
      messages: [{ role: 'user', content: prompt }],
    });

    const label = response.content[0].text.trim().toLowerCase();

    if (VALID_LABELS.includes(label)) {
      return { label, source: 'llm' };
    }

    return { label: 'unknown', source: 'llm' };
  } catch (err) {
    console.error('LLM classification error:', err.message);
    return { label: 'unknown', source: 'llm_error' };
  }
}

module.exports = { classifyByLLM, VALID_LABELS }; 