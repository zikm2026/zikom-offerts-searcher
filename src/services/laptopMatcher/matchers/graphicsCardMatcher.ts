export function isGraphicsCardMatch(
  laptopGraphicsCard: string | undefined,
  watchedGraphicsCard: string | null | undefined
): boolean {
  if (!watchedGraphicsCard || watchedGraphicsCard.trim() === '') {
    return true;
  }

  if (!laptopGraphicsCard || laptopGraphicsCard.trim() === '') {
    return false;
  }

  const options = watchedGraphicsCard
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (options.length === 0) return true;

  return options.some((option) =>
    isSingleGraphicsCardMatch(laptopGraphicsCard, option)
  );
}

function levenshtein(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  const dp: number[][] = Array(an + 1)
    .fill(null)
    .map(() => Array(bn + 1).fill(0));
  for (let i = 0; i <= an; i++) dp[i][0] = i;
  for (let j = 0; j <= bn; j++) dp[0][j] = j;
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[an][bn];
}

function wordMatchesWithTypo(laptop: string, word: string): boolean {
  if (laptop.includes(word)) return true;
  const len = word.length;
  if (len < 3 || len > 12) return false;
  for (let i = 0; i <= laptop.length - len; i++) {
    const sub = laptop.slice(i, i + len);
    if (levenshtein(sub, word) <= 1) return true;
  }
  return false;
}

function isSingleGraphicsCardMatch(
  laptopGraphicsCard: string,
  watchedOption: string
): boolean {
  const laptop = laptopGraphicsCard.toLowerCase().trim();
  const watched = watchedOption.toLowerCase().trim();

  if (laptop === watched) return true;
  if (laptop.includes(watched)) return true;
  if (watched.includes(laptop)) return true;

  const watchedWords = watched.split(/\s+/).filter((w) => w.length > 2);
  const allWordsMatch = watchedWords.every((word) =>
    wordMatchesWithTypo(laptop, word)
  );

  return allWordsMatch;
}
