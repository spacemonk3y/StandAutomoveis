import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, timeout, retry } from 'rxjs/operators';
import { Car, CarCreate, CarUpdate } from '../models/car.model';

const DEFAULT_API_BASE_BROWSER = (() => {
  try {
    const hn = (location.hostname || 'localhost');
    const host = hn === 'localhost' ? '127.0.0.1' : hn; // avoid ipv6 localhost flakiness
    const proto = location.protocol === 'https:' ? 'https' : 'http';
    return `${proto}://${host}:8000`;
  } catch { return 'http://127.0.0.1:8000'; }
})();

@Injectable({ providedIn: 'root' })
export class CarService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private getBaseUrl(): string {
    const env = (globalThis as any)?.__env__?.API_BASE_URL;
    if (env) return env;
    return isPlatformServer(this.platformId) ? 'http://backend:8000' : '/api';
  }
  constructor() {
    // Basic runtime check to aid debugging misconfigured base URLs
    try {
      console.log('[CarService] API base URL:', this.getBaseUrl());
    } catch {}
  }

  list(filters?: Partial<{ make: string; model: string; price_min: number; price_max: number; year_min: number; year_max: number; sort: 'price'|'mileage'|'year'|'id'; direction: 'asc'|'desc'; image_mode: 'first'|'all'; }>): Observable<Car[]> {
    let params = new HttpParams();
    if (filters) {
      const f = filters as any;
      for (const k of Object.keys(f)) {
        const v = f[k];
        if (v !== undefined && v !== null && v !== '') {
          params = params.set(k, String(v));
        }
      }
    }
    return this.http
      .get<Car[]>(`${this.getBaseUrl()}/cars`, { params })
      .pipe(
        retry({ count: 2, delay: 300 }),
        timeout(8000),
        catchError((err) => {
          try { console.warn('[CarService] list failed:', err?.message || err); } catch {}
          return of([] as Car[]);
        }),
      );
  }

  get(id: number): Observable<Car> {
    return this.http.get<Car>(`${this.getBaseUrl()}/cars/${id}`).pipe(retry({ count: 2, delay: 300 }), timeout(8000));
  }

  getFeatured(): Observable<Car> {
    return this.http.get<Car>(`${this.getBaseUrl()}/cars/featured`).pipe(retry({ count: 2, delay: 300 }), timeout(8000));
  }

  create(payload: CarCreate): Observable<Car> {
    return this.http.post<Car>(`${this.getBaseUrl()}/cars`, payload);
  }

  bulkCreate(payload: CarCreate[]): Observable<Car[]> {
    return this.http.post<Car[]>(`${this.getBaseUrl()}/cars/bulk`, payload);
  }

  import(file: File): Observable<Car[]> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<Car[]>(`${this.getBaseUrl()}/cars/import`, form);
  }

  update(id: number, payload: CarUpdate): Observable<Car> {
    return this.http.put<Car>(`${this.getBaseUrl()}/cars/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.getBaseUrl()}/cars/${id}`);
  }

  setFeatured(id: number): Observable<Car> {
    return this.http.put<Car>(`${this.getBaseUrl()}/cars/${id}/feature`, {});
  }

  clearFeatured(): Observable<void> {
    return this.http.delete<void>(`${this.getBaseUrl()}/cars/featured`);
  }
}
