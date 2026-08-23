export interface FuzzyMatchResult {
  score: number;
  indices: number[];
}

export function fuzzyMatch(text: string, query: string): FuzzyMatchResult | null {
  if (!query) return { score: 1, indices: [] };

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  if (queryLower.length > textLower.length) return null;

  let queryIdx = 0;
  let score = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -1;
  const indices: number[] = [];

  for (let i = 0; i < textLower.length && queryIdx < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIdx]) {
      indices.push(i);

      let matchScore = 1;

      // Start-of-string bonus
      if (i === 0) {
        matchScore += 10;
      }

      // After separator bonus (/, -, _, space)
      if (i > 0) {
        const prevChar = text[i - 1];
        if (prevChar === '/' || prevChar === '-' || prevChar === '_' || prevChar === ' ') {
          matchScore += 8;
        }
      }

      // Consecutive match bonus
      if (lastMatchIdx === i - 1) {
        consecutiveBonus += 5;
        matchScore += consecutiveBonus;
      } else {
        consecutiveBonus = 0;
      }

      // Exact case match bonus
      if (text[i] === query[queryIdx]) {
        matchScore += 2;
      }

      score += matchScore;
      lastMatchIdx = i;
      queryIdx++;
    }
  }

  if (queryIdx < queryLower.length) return null;

  // Penalty for unmatched characters
  score -= (textLower.length - queryLower.length) * 0.5;

  return { score: Math.max(0, score), indices };
}

export function highlightMatches(text: string, indices: number[]): string[] {
  const result: string[] = [];
  let lastIdx = 0;

  for (const idx of indices) {
    if (idx > lastIdx) {
      result.push(text.slice(lastIdx, idx));
    }
    result.push(`\x1b[1m\x1b[33m${text[idx]}\x1b[0m`);
    lastIdx = idx + 1;
  }

  if (lastIdx < text.length) {
    result.push(text.slice(lastIdx));
  }

  return result;
}

export function highlightMatchesHtml(text: string, indices: number[]): string {
  let result = '';
  let lastIdx = 0;

  for (const idx of indices) {
    if (idx > lastIdx) {
      result += escapeHtml(text.slice(lastIdx, idx));
    }
    result += `<mark class="text-amber-400 font-bold bg-transparent">${escapeHtml(text[idx])}</mark>`;
    lastIdx = idx + 1;
  }

  if (lastIdx < text.length) {
    result += escapeHtml(text.slice(lastIdx));
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
