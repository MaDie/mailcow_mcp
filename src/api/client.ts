import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { APIConfig } from '../types/index';
import { assertMailcowSuccess, MailcowAPIError } from './mailcow-response';

export class APIClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: APIConfig) {
    this.client = axios.create({ 
      baseURL: config.url, 
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    this.apiKey = config.key;
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add authentication
    this.client.interceptors.request.use(async (config) => {
      if (this.apiKey) {
        config.headers['X-API-Key'] = this.apiKey;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error status
          const { status, data } = error.response;
          throw new Error(`API Error ${status}: ${data?.message || data || 'Unknown error'}`);
        } else if (error.request) {
          // Request was made but no response received
          throw new Error('Network error: No response received');
        } else {
          // Something else happened
          throw new Error(`Request error: ${error.message}`);
        }
      }
    );
  }

  private unwrap<T>(data: T): T {
    assertMailcowSuccess(data);
    return data;
  }

  private wrapRequestError(method: string, error: unknown): never {
    if (error instanceof MailcowAPIError) {
      throw error;
    }
    throw new Error(
      `${method} request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, { params });
      return this.unwrap(response.data);
    } catch (error) {
      this.wrapRequestError('GET', error);
    }
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data);
      return this.unwrap(response.data);
    } catch (error) {
      this.wrapRequestError('POST', error);
    }
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.put(url, data);
      return this.unwrap(response.data);
    } catch (error) {
      this.wrapRequestError('PUT', error);
    }
  }

  async delete<T>(url: string): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(url);
      return this.unwrap(response.data);
    } catch (error) {
      this.wrapRequestError('DELETE', error);
    }
  }
} 