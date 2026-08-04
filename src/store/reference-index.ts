/**
 * Reverse-lookup bookkeeping shared by the stores.
 *
 * OParl records reference each other by id: a paper references its consultations
 * and its attachment files, a meeting references its organizations. Every store
 * that has to answer the reverse question — "which records reference this id?" —
 * needs the same pair of maps kept in sync on add, on re-add with a changed
 * reference list, and on removal. Three hand-written copies of that logic
 * existed, each re-deriving the same subtle rules: a reverse entry disappears
 * only when its last referrer does, and a re-indexed record must never release a
 * reference another record now holds.
 *
 * Terminology, used consistently below: the record holding the reference is the
 * **referrer**; the id it points at is the **referenced id**.
 */

/** Many referrers per referenced id (papers per attachment, meetings per organization). */
export class ReferenceIndex {
  private readonly referrersByReferencedId = new Map<string, Set<string>>();
  private readonly referencedIdsByReferrer = new Map<string, Set<string>>();

  /** Replaces the referrer's reference list, detaching whatever it pointed at before. */
  setReferences(referrerId: string, referencedIds: Iterable<string>): void {
    const nextReferencedIds = new Set(referencedIds);

    for (const referencedId of this.referencedIdsByReferrer.get(referrerId) ?? []) {
      if (nextReferencedIds.has(referencedId)) continue;
      this.detach(referrerId, referencedId);
    }

    for (const referencedId of nextReferencedIds) {
      let referrers = this.referrersByReferencedId.get(referencedId);
      if (!referrers) {
        referrers = new Set();
        this.referrersByReferencedId.set(referencedId, referrers);
      }
      referrers.add(referrerId);
    }

    if (nextReferencedIds.size > 0) {
      this.referencedIdsByReferrer.set(referrerId, nextReferencedIds);
    } else {
      this.referencedIdsByReferrer.delete(referrerId);
    }
  }

  removeReferrer(referrerId: string): void {
    for (const referencedId of this.referencedIdsByReferrer.get(referrerId) ?? []) {
      this.detach(referrerId, referencedId);
    }
    this.referencedIdsByReferrer.delete(referrerId);
  }

  getReferrers(referencedId: string): ReadonlySet<string> | undefined {
    return this.referrersByReferencedId.get(referencedId);
  }

  clear(): void {
    this.referrersByReferencedId.clear();
    this.referencedIdsByReferrer.clear();
  }

  private detach(referrerId: string, referencedId: string): void {
    const referrers = this.referrersByReferencedId.get(referencedId);
    if (!referrers) return;
    referrers.delete(referrerId);
    if (referrers.size === 0) this.referrersByReferencedId.delete(referencedId);
  }
}

/**
 * Exactly one referrer per referenced id, last writer winning.
 *
 * Used for consultation ids, which the API models as belonging to a single
 * paper. A referenced id is released only when the referrer that currently holds
 * it stops pointing at it, so re-indexing a record cannot revoke another
 * record's claim.
 */
export class ExclusiveReferenceIndex {
  private readonly referrerByReferencedId = new Map<string, string>();
  private readonly referencedIdsByReferrer = new Map<string, Set<string>>();

  setReferences(referrerId: string, referencedIds: Iterable<string>): void {
    const nextReferencedIds = new Set(referencedIds);

    for (const referencedId of this.referencedIdsByReferrer.get(referrerId) ?? []) {
      if (nextReferencedIds.has(referencedId)) continue;
      if (this.referrerByReferencedId.get(referencedId) === referrerId) {
        this.referrerByReferencedId.delete(referencedId);
      }
    }

    for (const referencedId of nextReferencedIds) {
      this.referrerByReferencedId.set(referencedId, referrerId);
    }

    if (nextReferencedIds.size > 0) {
      this.referencedIdsByReferrer.set(referrerId, nextReferencedIds);
    } else {
      this.referencedIdsByReferrer.delete(referrerId);
    }
  }

  removeReferrer(referrerId: string): void {
    for (const referencedId of this.referencedIdsByReferrer.get(referrerId) ?? []) {
      if (this.referrerByReferencedId.get(referencedId) === referrerId) {
        this.referrerByReferencedId.delete(referencedId);
      }
    }
    this.referencedIdsByReferrer.delete(referrerId);
  }

  getReferrer(referencedId: string): string | undefined {
    return this.referrerByReferencedId.get(referencedId);
  }

  clear(): void {
    this.referrerByReferencedId.clear();
    this.referencedIdsByReferrer.clear();
  }
}
