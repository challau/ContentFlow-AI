/**
 * Models sometimes wrap JSON in prose or code fences even when asked not to.
 * This recovers the JSON object without a second round trip.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();

  // Fast path: already valid.
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }

  // Fenced block, with or without a language tag.
  const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(text);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }

  // Balanced-brace scan from the first `{` or `[`, respecting string literals.
  const start = firstStructuralIndex(text);
  if (start === -1) {
    throw new SyntaxError('No JSON object found in model response');
  }

  const candidate = sliceBalanced(text, start);
  if (candidate) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Last resort: strip trailing commas, a common model slip.
      try {
        return JSON.parse(candidate.replace(/,(\s*[}\]])/g, '$1'));
      } catch (error) {
        throw new SyntaxError(
          `Model response was not valid JSON: ${(error as Error).message}`,
        );
      }
    }
  }

  throw new SyntaxError('Model response contained an unterminated JSON value');
}

function firstStructuralIndex(text: string): number {
  const brace = text.indexOf('{');
  const bracket = text.indexOf('[');
  if (brace === -1) return bracket;
  if (bracket === -1) return brace;
  return Math.min(brace, bracket);
}

function sliceBalanced(text: string, start: number): string | null {
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
