export const OPARL_PAGE_SIZE = 1000;
export const PDF_MIME_TYPE = 'application/pdf';
export const FEED_GENERATOR = 'Custom TypeScript Atom Feed Generator';
export const RECENT_FEED_MAX_ITEMS = 100;

/**
 * Atom category scheme for the submitting faction. OParl has no schema for this —
 * the value is derived from the paper's own PDF letterhead — so the scheme is
 * project-defined and must stay stable for subscribers filtering on it.
 */
export const SUBMITTER_CATEGORY_SCHEME =
  'https://github.com/karlsruhe-oparl-syndication/schema/submitter';
