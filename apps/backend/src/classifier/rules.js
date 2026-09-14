const RULES = [
  {
    label: 'null_pointer',
    pattern: /cannot read propert(y|ies) .* of (undefined|null)|typeerror.*undefined|typeerror.*null/i
  },
  {
    label: 'rate_limit',
    pattern: /rate limit|too many requests|429|etimedout|econnreset.*api/i
  },
  {
    label: 'memory_leak',
    pattern: /heap out of memory|javascript heap|fatal error.*allocation failed|max_old_space|unbounded cache|no eviction policy|heapused=\d+mb/i
  },
  {
    label: 'off_by_one',
    pattern: /pagination returned 0 items|despite.*total items existing|start=\d+.*end=\d+/i
  }
];

function classifyByRules(incident) {
  const text = `${incident.message || ''} ${incident.stack || ''}`;

  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { label: rule.label, source: 'rule' };
    }
  }

  return null;
}

module.exports = { classifyByRules, RULES };