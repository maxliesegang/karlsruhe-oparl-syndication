import { BaseStore } from './base-store.js';
import { Consultation } from '../types/index.js';

class ConsultationStore extends BaseStore<Consultation> {
  getFileName(): string {
    return 'consultations.json';
  }
}

export const consultationStore = new ConsultationStore();
