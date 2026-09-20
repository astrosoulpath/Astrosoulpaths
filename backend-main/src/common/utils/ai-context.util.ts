const DROP_KEYS = new Set([
  'providerPayload',
  'raw',
  'rawData',
  'rawResponse',
  'response',
  'svg',
  'html',
  'metadata',
  'generatedAt',
  'completeness',
]);

function compactValue(value: unknown): unknown {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => compactValue(item))
      .filter((item) => item !== undefined);

    return items.length > 0 ? items : undefined;
  }

  if (typeof value !== 'object') {
    return value;
  }

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(source)) {
    if (DROP_KEYS.has(key)) {
      continue;
    }

    const compacted = compactValue(item);

    if (compacted !== undefined) {
      output[key] = compacted;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function serializeAiAstrologyContext(
  value: unknown,
  maxChars = 30000,
): string {
  const compacted = compactValue(value) ?? {};

  const serialized = JSON.stringify(compacted);

  if (serialized.length <= maxChars) {
    return serialized;
  }

  /*
   * Never silently slice JSON because that can corrupt astrology facts.
   * Remove only known low-value bulky sections on overflow.
   */
  if (
    compacted &&
    typeof compacted === 'object' &&
    !Array.isArray(compacted)
  ) {
    const reduced = {
      ...(compacted as Record<string, unknown>),
    };

    const overflowDropOrder = [
      'analysis',
      'providerPredictions',
      'providerGuidance',
      'majorDivisionalCharts',
      'ashtakavarga',
      'shadbala',
    ];

    for (const key of overflowDropOrder) {
      delete reduced[key];

      const candidate = JSON.stringify(reduced);

      if (candidate.length <= maxChars) {
        return candidate;
      }
    }
  }

  /*
   * Fail closed instead of sending malformed/truncated Kundli.
   */
  throw new Error(
    `AI astrology context exceeds safe limit (${serialized.length} chars)`,
  );
}
