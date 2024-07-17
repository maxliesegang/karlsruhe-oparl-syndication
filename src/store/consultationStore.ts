import { BaseStore } from './baseStore';
import { Consultation } from '../types';

class ConsultationStore extends BaseStore<Consultation> {
  getFileName(): string {
    return 'consultationStore.json';
  }
}

export const consultationStore = new ConsultationStore();
