export function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[a.length][b.length];
}

const PREFIXES_TO_STRIP = ["لل", "بال", "وال", "فال", "كال", "ال"];

function stripPrefix(word: string): string {
  for (const prefix of PREFIXES_TO_STRIP) {
    if (word.length > prefix.length + 1 && word.startsWith(prefix)) {
      return word.slice(prefix.length);
    }
  }

  return word;
}

function maxAllowedDistance(wordLength: number): number {
  if (wordLength <= 3) return 0;
  if (wordLength <= 6) return 1;
  return 2;
}

function wordFuzzyMatches(word: string, textWords: string[]): boolean {
  const allowed = maxAllowedDistance(word.length);

  return textWords.some((textWord) => levenshtein(word, textWord) <= allowed);
}

export function fuzzyIncludes(text: string, keyword: string): boolean {
  const textWords = text.split(" ").filter(Boolean).map(stripPrefix);
  const keywordWords = keyword.split(" ").filter(Boolean).map(stripPrefix);

  return keywordWords.every((word) => wordFuzzyMatches(word, textWords));
}

export function fuzzyIncludesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => fuzzyIncludes(text, keyword));
}
