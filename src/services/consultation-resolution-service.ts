import { fetchAndStoreConsultation, fetchAndStorePaper } from '../api/index.js';
import axios from 'axios';
import { readJsonFromFile, writeJsonToFile } from '../file-utils.js';
import { logger } from '../logger.js';
import { stores } from '../store/index.js';
import { Meeting } from '../types/index.js';

export interface ConsultationResolutionResult {
  agendaItemsWithConsultation: number;
  uniqueConsultations: number;
  alreadyResolved: number;
  consultationsFetched: number;
  papersFetched: number;
  missingConsultations: number;
  consultationsWithoutPaper: number;
  missingPapers: number;
  failedConsultations: number;
  failedPapers: number;
  deferredPapers: number;
  deferredConsultations: number;
  unresolved: number;
}

interface PaperRetryEntry {
  attempts: number;
  lastAttemptAt: string;
  nextRetryAt: string;
  status?: number;
  reason: string;
}

type PaperRetryLedger = Record<string, PaperRetryEntry>;

const RETRY_LEDGER_FILE = 'consultation-resolution-failures.json';
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTHORIZATION_RETRY_MS = 7 * DAY_MS;
const NOT_FOUND_RETRY_MS = 7 * DAY_MS;
const BOOTSTRAP_RETRY_MS = 7 * DAY_MS;
const MAX_TRANSIENT_RETRY_MS = 7 * DAY_MS;

export interface ConsultationResolutionOptions {
  now?: Date;
}

/**
 * Resolves agenda-item consultation references that were not covered by the
 * incremental papers crawl. A consultation points at its paper, so fetching
 * both resources repairs the paper store's consultation-to-paper index.
 */
export async function resolveMissingConsultationPapers(
  meetings: Meeting[],
  options: ConsultationResolutionOptions = {},
): Promise<ConsultationResolutionResult> {
  const now = options.now ?? new Date();
  const retryLedger =
    (await readJsonFromFile<PaperRetryLedger>(RETRY_LEDGER_FILE)) ?? ({} as PaperRetryLedger);
  for (const entry of Object.values(retryLedger)) {
    if (entry.reason !== 'bootstrap') continue;
    const minimumRetryAt = new Date(entry.lastAttemptAt).getTime() + BOOTSTRAP_RETRY_MS;
    if (new Date(entry.nextRetryAt).getTime() < minimumRetryAt) {
      entry.nextRetryAt = new Date(minimumRetryAt).toISOString();
    }
  }
  const consultationIds: string[] = [];
  let agendaItemsWithConsultation = 0;

  for (const meeting of meetings) {
    for (const agendaItem of meeting.agendaItem ?? []) {
      if (!agendaItem.consultation) continue;
      agendaItemsWithConsultation++;
      consultationIds.push(agendaItem.consultation);
    }
  }

  const uniqueConsultationIds = [...new Set(consultationIds)];
  const result: ConsultationResolutionResult = {
    agendaItemsWithConsultation,
    uniqueConsultations: uniqueConsultationIds.length,
    alreadyResolved: 0,
    consultationsFetched: 0,
    papersFetched: 0,
    missingConsultations: 0,
    consultationsWithoutPaper: 0,
    missingPapers: 0,
    failedConsultations: 0,
    failedPapers: 0,
    deferredPapers: 0,
    deferredConsultations: 0,
    unresolved: 0,
  };

  const attemptedPaperIds = new Set<string>();
  const deferredPaperIds = new Set<string>();
  const referencedPaperIds = new Set<string>();

  for (const consultationId of uniqueConsultationIds) {
    if (stores.papers.getPaperByConsultationId(consultationId)) {
      result.alreadyResolved++;
      continue;
    }

    let consultation = stores.consultations.getById(consultationId);
    const consultationWasCached = !!consultation;
    if (!consultation) {
      try {
        consultation = (await fetchAndStoreConsultation(consultationId)) ?? undefined;
        if (consultation) result.consultationsFetched++;
      } catch (error) {
        result.failedConsultations++;
        logger.warn(`Failed to fetch consultation ${consultationId}`, error);
        continue;
      }
    }

    if (!consultation) {
      result.missingConsultations++;
      continue;
    }

    if (!consultation.paper) {
      result.consultationsWithoutPaper++;
      continue;
    }
    referencedPaperIds.add(consultation.paper);

    const retryEntry = retryLedger[consultation.paper];
    if (retryEntry && new Date(retryEntry.nextRetryAt).getTime() > now.getTime()) {
      if (!deferredPaperIds.has(consultation.paper)) result.deferredPapers++;
      deferredPaperIds.add(consultation.paper);
      result.deferredConsultations++;
      continue;
    }

    // Upgrade path for consultations cached by a run that predates the retry
    // ledger. Defer once rather than immediately repeating hundreds of known
    // unresolved requests; the next run after the cooldown records a status.
    if (consultationWasCached && !retryEntry) {
      retryLedger[consultation.paper] = createRetryEntry(now, 0, undefined, 'bootstrap');
      result.deferredPapers++;
      result.deferredConsultations++;
      deferredPaperIds.add(consultation.paper);
      continue;
    }

    if (attemptedPaperIds.has(consultation.paper)) {
      result.deferredConsultations++;
      continue;
    }
    attemptedPaperIds.add(consultation.paper);

    try {
      const paper = await fetchAndStorePaper(consultation.paper);
      if (paper) {
        result.papersFetched++;
        delete retryLedger[consultation.paper];
      } else {
        result.missingPapers++;
        retryLedger[consultation.paper] = createRetryEntry(
          now,
          (retryEntry?.attempts ?? 0) + 1,
          404,
          'not-found',
        );
      }
    } catch (error) {
      result.failedPapers++;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      retryLedger[consultation.paper] = createRetryEntry(
        now,
        (retryEntry?.attempts ?? 0) + 1,
        status,
        status === 401 || status === 403 ? 'unauthorized' : 'request-failed',
      );
      logger.warn(`Failed to fetch paper ${consultation.paper}`, error);
    }
  }

  result.unresolved = uniqueConsultationIds.reduce(
    (count, consultationId) =>
      count + (stores.papers.getPaperByConsultationId(consultationId) ? 0 : 1),
    0,
  );

  for (const paperId of Object.keys(retryLedger)) {
    if (!referencedPaperIds.has(paperId)) delete retryLedger[paperId];
  }
  await writeJsonToFile(retryLedger, RETRY_LEDGER_FILE);

  logger.info(
    `Consultation resolution: ${result.uniqueConsultations - result.unresolved}/${result.uniqueConsultations} resolved ` +
      `(${result.alreadyResolved} cached, ${result.consultationsFetched} consultations fetched, ` +
      `${result.papersFetched} papers fetched).`,
  );

  if (result.unresolved > 0) {
    logger.warn(
      `${result.unresolved} consultation reference(s) remain unresolved ` +
        `(${result.missingConsultations} missing consultations, ` +
        `${result.consultationsWithoutPaper} without a paper reference, ` +
        `${result.missingPapers} missing papers, ` +
        `${result.failedConsultations + result.failedPapers} fetch failures, ` +
        `${result.deferredConsultations} deferred by retry policy).`,
    );
  }

  return result;
}

function createRetryEntry(
  now: Date,
  attempts: number,
  status: number | undefined,
  reason: string,
): PaperRetryEntry {
  const retryMs =
    reason === 'bootstrap'
      ? BOOTSTRAP_RETRY_MS
      : status === 401 || status === 403
        ? AUTHORIZATION_RETRY_MS
        : status === 404
          ? NOT_FOUND_RETRY_MS
          : Math.min(2 ** Math.max(0, attempts - 1) * DAY_MS, MAX_TRANSIENT_RETRY_MS);

  return {
    attempts,
    lastAttemptAt: now.toISOString(),
    nextRetryAt: new Date(now.getTime() + retryMs).toISOString(),
    status,
    reason,
  };
}
