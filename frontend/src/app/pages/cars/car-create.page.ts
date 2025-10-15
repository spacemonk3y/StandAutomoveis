import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CarService } from '../../services/car.service';

@Component({
  selector: 'app-car-create-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './car-create.page.html',
  styleUrl: './car-create.page.less'
})
export class CarCreatePageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly carService = inject(CarService);
  private readonly router = inject(Router);

  form = this.fb.group({
    url: [''],
    title: [''],
    make: ['', Validators.required],
    model: ['', Validators.required],
    version: [''],
    color: [''],
    doors: [null],
    seats: [null],
    engine_capacity_cc: [null],
    engine_power_cv: [null],
    fuel_type: [''],
    body_type: [''],
    gearbox: [''],
    transmission: [''],
    mileage_km: [null],
    registration_month: [''],
    registration_year: [null],
    price: [null],
    currency: ['EUR'],
    images: this.fb.control<string>(''), // comma-separated
  });

  saving = false;
  error?: string;

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.value;
    const images = (value.images || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      ...value,
      images: images.length ? images : undefined,
    } as any;
    delete payload.images; // will add below conditionally
    if (images.length) payload.images = images;

    this.saving = true;
    this.carService.create(payload).subscribe({
      next: (car) => {
        this.saving = false;
        this.router.navigate(['/cars', car.id]);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.message ?? 'Failed to create car';
      },
    });
  }
}

