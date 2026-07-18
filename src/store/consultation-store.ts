import { BaseStore } from './base-store.js';
import { Consultation } from '../types/index.js';

class ConsultationStore extends BaseStore<Consultation> {
  readonly storageFileName = 'consultations.json';
}

export const consultationStore = new ConsultationStore();
