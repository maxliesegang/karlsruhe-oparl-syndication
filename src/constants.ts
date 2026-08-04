export const OPARL_PAGE_SIZE = 1000;
export const PDF_MIME_TYPE = 'application/pdf';
export const FEED_GENERATOR = 'Custom TypeScript Atom Feed Generator';
export const RECENT_FEED_MAX_ITEM_COUNT = 100;

/**
 * Deterministic stand-in for records (and an empty feed) that carry no usable
 * date. A fixed epoch rather than the run clock keeps the XML byte-stable across
 * runs: a date-less entry no longer churns every run, and it cannot push the
 * feed-level <updated> to "now" and defeat conditional-GET/304 for readers.
 *
 * Shared so the record builder and the feed writer cannot pick different
 * fallbacks and disagree about an entry's sort position.
 */
export const EPOCH_FALLBACK_DATE = new Date(0);

/**
 * Atom category scheme for the submitting faction. OParl has no schema for this —
 * the value is derived from the paper's own PDF letterhead — so the scheme is
 * project-defined and must stay stable for subscribers filtering on it.
 */
export const SUBMITTER_CATEGORY_SCHEME =
  'https://github.com/karlsruhe-oparl-syndication/schema/submitter';
