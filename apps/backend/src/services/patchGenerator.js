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

Call the submit_patch tool with your fix.`;
}

const PATCH_TOOL = {
  name: 'submit_patch',
  description: 'Submit the generated code patch for the bug.',
  input_schema: {
    type: 'object',
    properties: {
      explanation: {
        type: 'string',
        description: 'One or two sentences on what was wrong and how this fixes it.',
      },
      confidence_score: {
        type: 'number',
        description: 'Confidence in the fix, from 0.0 to 1.0.',
      },
      patched_code: {
        type: 'string',
        description: 'The FULL corrected file contents, not just the changed lines.',
      },
    },
    required: ['explanation', 'confidence_score', 'patched_code'],
  },
};

async function generatePatch(incident) {
  const { relativePath, code } = getSourceFileForIncident(incident);
  const similarIncidents = await findSimilarIncidents(incident, 3);

  const prompt = buildPrompt({ incident, sourceCode: code, relativePath, similarIncidents });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    tools: [PATCH_TOOL],
    tool_choice: { type: 'tool', name: 'submit_patch' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUseBlock = response.content.find((block) => block.type === 'tool_use');

  if (!toolUseBlock) {
    throw new Error('LLM did not call submit_patch tool as expected.');
  }

  const parsed = toolUseBlock.input;

  return {
    target_file: relativePath,
    generated_diff: parsed.patched_code,
    explanation: parsed.explanation,
    confidence_score: parsed.confidence_score,
  };
}

module.exports = { generatePatch };