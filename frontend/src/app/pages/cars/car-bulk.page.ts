import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CarService } from '../../services/car.service';
import { timeout, finalize } from 'rxjs/operators';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-car-bulk-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './car-bulk.page.html',
  styleUrl: './car-bulk.page.less'
})
export class CarBulkCreatePageComponent {
  private readonly carService = inject(CarService);
  private readonly cdr = inject(ChangeDetectorRef);

  jsonText = '[\n  {\n    "make": "Peugeot",\n    "model": "3008",\n    "price": 24990,\n    "currency": "EUR"\n  }\n]';
  file?: File;
  importing = false;
  creating = false;
  error?: string;
  resultCount?: number;

  onFileChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.file = input.files[0];
    }
  }

  importFile(): void {
    if (!this.file) return;
    console.log('Import file selected:', this.file?.name, this.file?.size);
    this.importing = true;
    this.error = undefined;
    this.resultCount = undefined;
    this.carService
      .import(this.file)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.importing = false;
          try { this.cdr.detectChanges(); } catch {}
        })
      )
      .subscribe({
        next: (cars) => {
          console.log('Import OK, count:', cars.length);
          this.resultCount = cars.length;
          try { this.cdr.detectChanges(); } catch {}
        },
        error: (err) => {
          console.warn('Import error:', err);
          this.error = (err && (err.message || err.statusText)) || 'Import failed';
          try { this.cdr.detectChanges(); } catch {}
        },
      });
  }

  createBulk(): void {
    let payload: any[];
    try {
      payload = JSON.parse(this.jsonText);
      if (!Array.isArray(payload)) throw new Error('JSON must be an array');
    } catch (e: any) {
      this.error = 'Invalid JSON: ' + (e?.message || e);
      return;
    }
    console.log('Bulk create payload length:', payload.length);
    this.creating = true;
    this.error = undefined;
    this.resultCount = undefined;
    this.carService
      .bulkCreate(payload)
      .pipe(
        timeout(15000),
        finalize(() => {
          this.creating = false;
          try { this.cdr.detectChanges(); } catch {}
        })
      )
      .subscribe({
        next: (cars) => {
          console.log('Bulk create OK, count:', cars.length);
          this.resultCount = cars.length;
          try { this.cdr.detectChanges(); } catch {}
        },
        error: (err) => {
          console.warn('Bulk create error:', err);
          this.error = (err && (err.message || err.statusText)) || 'Bulk create failed';
          try { this.cdr.detectChanges(); } catch {}
        },
      });
  }
}
