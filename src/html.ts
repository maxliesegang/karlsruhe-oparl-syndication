/**
 * Escapes text for interpolation into HTML markup.
 *
 * Single source of truth for the feed entry bodies and the landing page. The two
 * used to carry separate copies and had drifted: the landing page's version left
 * `'` unescaped, which is safe inside element text but not inside the
 * single-quoted attributes either renderer is free to emit. Escaping all five
 * characters everywhere removes that class of difference.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Returns the normalized href when `value` is an http(s) URL, otherwise
 * undefined — so a `javascript:` or malformed URL from upstream data never
 * reaches a rendered link.
 */
export function safeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
