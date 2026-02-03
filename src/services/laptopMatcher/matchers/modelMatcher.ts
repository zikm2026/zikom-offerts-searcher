export function isModelMatch(
  laptopModel: string | undefined,
  watchedModel: string
): boolean {
  if (!laptopModel) return false;

  const laptop = laptopModel.toLowerCase().trim();
  const watched = watchedModel.toLowerCase().trim();

  if (laptop === watched) return true;
  if (laptop.includes(watched)) return true;
  if (watched.includes(laptop)) return true;

  const watchedWords = watched.split(/\s+/);
  const laptopWords = laptop.split(/\s+/);

  const allWordsMatch = watchedWords.every((word) =>
    laptopWords.some((lw) => lw.includes(word) || word.includes(lw))
  );

  return allWordsMatch;
}
