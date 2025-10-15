import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Car } from '../../models/car.model';
import { CarService } from '../../services/car.service';

@Component({
  selector: 'app-car-edit-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './car-edit.page.html',
  styleUrl: './car-edit.page.less'
})
export class CarEditPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly carService = inject(CarService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  car?: Car;
  loading = false;
  saving = false;
  error?: string;

  form = this.fb.group({
    title: [''],
    price: [null as number | null],
    mileage_km: [null as number | null],
    color: [''],
    gearbox: [''],
    images: this.fb.control<string>(''), // comma-separated
  });

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id');
    const id = raw != null ? Number.parseInt(String(raw), 10) : NaN;
    if (Number.isNaN(id) || id <= 0) {
      this.router.navigate(['/cars']);
      return;
    }
    this.fetch(id);
  }

  fetch(id: number): void {
    this.loading = true;
    this.carService.get(id).subscribe({
      next: (car) => {
        this.car = car;
        this.loading = false;
        this.form.patchValue({
          title: car.title ?? '',
          price: (car.price as any) ?? null,
          mileage_km: car.mileage_km ?? null,
          color: car.color ?? '',
          gearbox: car.gearbox ?? '',
          images: car.images?.join(', ') ?? '',
        });
        try { this.cdr.detectChanges(); } catch {}
      },
      error: (err) => {
        this.error = err?.message ?? 'Failed to load car';
        this.loading = false;
        try { this.cdr.detectChanges(); } catch {}
      },
    });
  }

  save(): void {
    if (!this.car) return;
    const value = this.form.value;
    const images = (value.images || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: any = {
      title: value.title,
      price: value.price,
      mileage_km: value.mileage_km,
      color: value.color,
      gearbox: value.gearbox,
    };
    if (images.length) payload.images = images;
    this.saving = true;
    this.carService.update(this.car.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.car = updated;
        try { this.cdr.detectChanges(); } catch {}
        this.router.navigate(['/cars/manage']);
      },
      error: (err) => {
        this.saving = false;
        alert(err?.message ?? 'Update failed');
        try { this.cdr.detectChanges(); } catch {}
      },
    });
  }
}
