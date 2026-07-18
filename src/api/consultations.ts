import { Consultation } from '../types/index.js';
import { store } from '../store/index.js';
import { fetchOne } from './http.js';
import { logger } from '../logger.js';

export async function fetchConsultation(url: string): Promise<Consultation | null> {
  logger.debug(`Fetching consultation from: ${url}`);

  const consultation = await fetchOne<Consultation>(url);

  if (consultation) {
    store.consultations.add(consultation);
    logger.debug(`Successfully fetched consultation: ${consultation.id}`);
  }

  return consultation;
}
