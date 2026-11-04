/**
 * Prompt versions are strings like `paper-de-v8`: a family prefix and a number.
 * Two versions compare only within one family; anything else is incomparable.
 */
const PROMPT_VERSION_PATTERN = /^(.*)-v(\d+)$/;

/** Negative, zero or positive like a sort comparator; undefined across families. */
export function comparePromptVersions(a: string, b: string): number | undefined {
  const left = PROMPT_VERSION_PATTERN.exec(a);
  const right = PROMPT_VERSION_PATTERN.exec(b);
  if (!left || !right || left[1] !== right[1]) return undefined;
  return Number(left[2]) - Number(right[2]);
}

/**
 * Whether an output written under `version` may still be published.
 *
 * The current version always may. An older one may if it is at least `minimum`,
 * which is set deliberately with each prompt bump: a bump that only changes style
 * leaves it alone, so the existing outputs stay visible and are upgraded over the
 * following runs; a bump that fixes something an old output gets *wrong* raises it,
 * which withdraws those outputs at once. A count of "the last N versions" was
 * considered and rejected — it measures how often the prompt was edited, not whether
 * an old text is still true. An unparseable or foreign version is never published.
 */
export function isPublishablePromptVersion(
  version: string,
  current: string,
  minimum: string,
): boolean {
  if (version === current) return true;
  const toMinimum = comparePromptVersions(version, minimum);
  const toCurrent = comparePromptVersions(version, current);
  return toMinimum !== undefined && toMinimum >= 0 && toCurrent !== undefined && toCurrent < 0;
}
