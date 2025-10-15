import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Car } from '../../models/car.model';
import { CarService } from '../../services/car.service';
import { catchError, finalize, timeout, retry } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule],
  templateUrl: './home.page.html',
  styleUrl: './home.page.less'
})
export class HomePageComponent implements OnInit, OnDestroy {
  private readonly carService = inject(CarService);
  private readonly cdr = inject(ChangeDetectorRef);

  cars: Car[] = [];
  featured: Car | null = null;
  loading = false;
  error?: string;
  validUntil: string = '';
  // Filters state
  make = '';
  model = '';
  price_min?: number;
  price_max?: number;
  year_min?: number;
  year_max?: number;
  sort: 'price'|'mileage'|'year'|'id' = 'price';
  direction: 'asc'|'desc' = 'asc';
  // UI state: show/hide extra filters
  showMoreFilters = false;
  // Hero: no collapse/snap logic (normal scroll)

  ngOnInit(): void {
    this.validUntil = this.computeValidUntil(7);
    this.fetch();
  }

  ngOnDestroy(): void {
    // no-op
  }

  private fetch(): void {
    this.loading = true;
    const cars$ = this.carService
      .list({
        make: this.make || undefined,
        model: this.model || undefined,
        price_min: this.price_min ?? undefined,
        price_max: this.price_max ?? undefined,
        year_min: this.year_min ?? undefined,
        year_max: this.year_max ?? undefined,
        sort: this.sort,
        direction: this.direction,
        image_mode: 'first',
      })
      .pipe(
        retry({ count: 2, delay: 300 }),
        timeout(10000),
        catchError((err) => {
          this.error = err?.message ?? 'Falha ao carregar carros';
          return of([] as Car[]);
        }),
      );

    const featured$ = this.carService
      .getFeatured()
      .pipe(
        retry({ count: 2, delay: 300 }),
        timeout(10000),
        catchError(() => of(null as unknown as Car)),
      );

    forkJoin({ cars: cars$, featured: featured$ })
      .pipe(finalize(() => { this.loading = false; try { this.cdr.detectChanges(); } catch {} }))
      .subscribe(({ cars, featured }) => {
        this.error = undefined;
        const list = (cars ?? []).slice(0, 12);
        this.cars = list;
        // Prefer explicit featured from API; fallback to first featured in list
        this.featured = featured ?? list.find(c => !!c?.is_featured) ?? null;
        try { this.cdr.detectChanges(); } catch {}
      });
  }

  onSearch(): void {
    this.fetch();
  }

  onReset(): void {
    this.make = this.model = '';
    this.price_min = this.price_max = this.year_min = this.year_max = undefined;
    this.sort = 'price';
    this.direction = 'asc';
    this.fetch();
  }

  private computeValidUntil(daysAhead: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  toggleFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
    try { this.cdr.detectChanges(); } catch {}
  }
}
