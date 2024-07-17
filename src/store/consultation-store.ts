import { BaseStore } from './base-store';
import { Consultation } from '../types';

class ConsultationStore extends BaseStore<Consultation> {
  getFileName(): string {
    return 'consultations.json';
  }
}

export const consultationStore = new ConsultationStore();
