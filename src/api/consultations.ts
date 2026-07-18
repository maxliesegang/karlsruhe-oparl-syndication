import { Consultation } from '../types/index.js';
import { stores } from '../store/index.js';
import { fetchOParlResource } from './http.js';
import { logger } from '../logger.js';

export async function fetchAndStoreConsultation(url: string): Promise<Consultation | null> {
  logger.debug(`Fetching consultation from: ${url}`);

  const consultation = await fetchOParlResource<Consultation>(url);

  if (consultation) {
    stores.consultations.add(consultation);
    logger.debug(`Successfully fetched consultation: ${consultation.id}`);
  }

  return consultation;
}
