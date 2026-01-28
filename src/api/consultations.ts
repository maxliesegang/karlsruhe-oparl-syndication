import { Consultation } from '../types';
import { store } from '../store';
import { fetchOne } from './http';
import { logger } from '../logger';

export async function fetchConsultation(url: string): Promise<Consultation | null> {
  logger.debug(`Fetching consultation from: ${url}`);

  const consultation = await fetchOne<Consultation>(url);

  if (consultation) {
    store.consultations.add(consultation);
    logger.debug(`Successfully fetched consultation: ${consultation.id}`);
  }

  return consultation;
}
