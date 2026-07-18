import { fetchConsultation, fetchPaper } from '../api/index.js';
import { logger } from '../logger.js';
import { store } from '../store/index.js';
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
  unresolved: number;
}

/**
 * Resolves agenda-item consultation references that were not covered by the
 * incremental papers crawl. A consultation points at its paper, so fetching
 * both resources repairs the paper store's consultation-to-paper index.
 */
export async function resolveMissingConsultationPapers(
  meetings: Meeting[],
): Promise<ConsultationResolutionResult> {
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
    unresolved: 0,
  };

  const attemptedPaperIds = new Set<string>();

  for (const consultationId of uniqueConsultationIds) {
    if (store.papers.getPaperByConsultationId(consultationId)) {
      result.alreadyResolved++;
      continue;
    }

    let consultation = store.consultations.getById(consultationId);
    if (!consultation) {
      try {
        consultation = (await fetchConsultation(consultationId)) ?? undefined;
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

    if (attemptedPaperIds.has(consultation.paper)) continue;
    attemptedPaperIds.add(consultation.paper);

    try {
      const paper = await fetchPaper(consultation.paper);
      if (paper) {
        result.papersFetched++;
      } else {
        result.missingPapers++;
      }
    } catch (error) {
      result.failedPapers++;
      logger.warn(`Failed to fetch paper ${consultation.paper}`, error);
    }
  }

  result.unresolved = uniqueConsultationIds.reduce(
    (count, consultationId) =>
      count + (store.papers.getPaperByConsultationId(consultationId) ? 0 : 1),
    0,
  );

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
        `${result.failedConsultations + result.failedPapers} fetch failures).`,
    );
  }

  return result;
}
