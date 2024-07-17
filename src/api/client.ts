import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '../config';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.allMeetingsApiUrl,
      timeout: 10000,
    });
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  // Add other methods as needed (put, delete, etc.)
}

export const apiClient = new ApiClient();
