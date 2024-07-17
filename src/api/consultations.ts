// src/api/consultations.ts
import axios from 'axios';
import { Consultation } from '../types';
import { store } from '../store';
import { correctUrl, requestQueue } from './common';

export async function fetchConsultation(url: string): Promise<Consultation | null> {
  return new Promise((resolve, reject) => {
    requestQueue.add(async () => {
      try {
        console.log(`Fetching consultation from: ${url}`);
        const correctedUrl = correctUrl(url);
        const response = await axios.get<Consultation>(correctedUrl);
        console.log(`Successfully fetched consultation: ${response.data.id}`);
        store.consultations.add(response.data);
        resolve(response.data);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          console.log(`Consultation not found: ${url}`);
          resolve(null);
          return;
        }
        console.error('Error fetching consultation:', error);
        reject(error);
      }
    });
  });
}
