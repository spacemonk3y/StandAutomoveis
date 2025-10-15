import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { Car } from '../../models/car.model';
import { CarService } from '../../services/car.service';
import { catchError, finalize, timeout } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-car-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule],
  templateUrl: './car-list.page.html',
  styleUrl: './car-list.page.less'
})
export class CarListPageComponent implements OnInit {
  private readonly carService = inject(CarService);
  private readonly cdr = inject(ChangeDetectorRef);
  cars: Car[] = [];
  loading = false;
  error?: string;
  featured: Car | null = null;

  // Filters
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

  ngOnInit(): void { this.fetch(); }

  fetch(): void {
    this.loading = true;
    this.carService.list({
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
        timeout(10000),
        catchError(err => {
          this.error = err?.message ?? 'Failed to load cars';
          return of([] as Car[]);
        }),
        finalize(() => { this.loading = false; try { this.cdr.detectChanges(); } catch {} }),
      )
      .subscribe((cars) => {
        this.cars = cars;
        this.featured = cars.find(c => !!c.is_featured) ?? null;
        try { this.cdr.detectChanges(); } catch {}
      });
  }

  onSearch(): void { this.fetch(); }
  onReset(): void {
    this.make = this.model = '';
    this.price_min = this.price_max = this.year_min = this.year_max = undefined;
    this.sort = 'price';
    this.direction = 'asc';
    this.fetch();
  }

  toggleFilters(): void {
    this.showMoreFilters = !this.showMoreFilters;
    try { this.cdr.detectChanges(); } catch {}
  }
}
