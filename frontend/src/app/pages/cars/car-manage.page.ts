import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Car } from '../../models/car.model';
import { CarService } from '../../services/car.service';

@Component({
  selector: 'app-car-manage-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './car-manage.page.html',
  styleUrl: './car-manage.page.less'
})
export class CarManagePageComponent implements OnInit {
  private readonly carService = inject(CarService);
  private readonly cdr = inject(ChangeDetectorRef);
  cars: Car[] = [];
  loading = false;
  error?: string;
  deleting = new Set<number>();
  featuring = new Set<number>();
  clearing = false;

  ngOnInit(): void {
    this.fetch();
  }

  fetch(): void {
    this.loading = true;
    this.carService.list().subscribe({
      next: (cars) => {
        this.cars = cars;
        this.loading = false;
        try { this.cdr.detectChanges(); } catch {}
      },
      error: (err) => {
        this.error = err?.message ?? 'Failed to load cars';
        this.loading = false;
        try { this.cdr.detectChanges(); } catch {}
      },
    });
  }

  confirmAndDelete(car: Car): void {
    if (!confirm(`Delete car #${car.id}?`)) return;
    this.deleting.add(car.id);
    this.carService.delete(car.id).subscribe({
      next: () => {
        this.deleting.delete(car.id);
        this.cars = this.cars.filter(c => c.id !== car.id);
        try { this.cdr.detectChanges(); } catch {}
      },
      error: (err) => {
        this.deleting.delete(car.id);
        alert(err?.message ?? 'Delete failed');
        try { this.cdr.detectChanges(); } catch {}
      }
    });
  }

  setAsFeatured(car: Car): void {
    if (!confirm(`Definir o carro #${car.id} como oportunidade da semana?`)) return;
    this.featuring.add(car.id);
    this.carService.setFeatured(car.id).subscribe({
      next: (updated) => {
        this.featuring.delete(car.id);
        // reflect in local list: only one featured
        this.cars = this.cars.map(c => ({ ...c, is_featured: c.id === updated.id }));
        try { this.cdr.detectChanges(); } catch {}
      },
      error: (err) => {
        this.featuring.delete(car.id);
        alert(err?.message ?? 'Falha ao definir destaque');
        try { this.cdr.detectChanges(); } catch {}
      },
    });
  }

  unfeature(car: Car): void {
    if (!car.is_featured) return;
    if (!confirm(`Remover o destaque do carro #${car.id}?`)) return;
    this.clearing = true;
    // Simpler and more robust: just set this car's flag to false
    this.carService.update(car.id, { is_featured: false }).subscribe({
      next: (updated) => {
        this.clearing = false;
        this.cars = this.cars.map(c => c.id === updated.id ? { ...c, is_featured: false } : c);
        try { this.cdr.detectChanges(); } catch {}
      },
      error: (err) => {
        this.clearing = false;
        alert(err?.message ?? 'Falha ao remover destaque');
        try { this.cdr.detectChanges(); } catch {}
      }
    });
  }
}
