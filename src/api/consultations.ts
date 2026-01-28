import { Consultation } from '../types';
import { store } from '../store';
import { fetchOne } from './http';

export async function fetchConsultation(url: string): Promise<Consultation | null> {
  console.log(`Fetching consultation from: ${url}`);

  const consultation = await fetchOne<Consultation>(url);

  if (consultation) {
    store.consultations.add(consultation);
    console.log(`Successfully fetched consultation: ${consultation.id}`);
  }

  return consultation;
}
