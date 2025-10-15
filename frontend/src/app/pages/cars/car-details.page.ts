import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Car } from '../../models/car.model';
import { CarService } from '../../services/car.service';

@Component({
  selector: 'app-car-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './car-details.page.html',
  styleUrl: './car-details.page.less'
})
export class CarDetailsPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly carService = inject(CarService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);

  car?: Car;
  loading = false;
  error?: string;

  // Gallery state
  currentIdx = 0;
  private rotateTimer: any = null;
  private readonly rotateMs = 2500; // 2.5s
  selectedIdx: number | null = null;
  readonly thumbLimit = 10;

  // Lightbox state
  overlayOpen = false;
  overlayIdx = 0;
  overlayGrid = false;

  ngOnInit(): void {
    const tryFetch = (raw: string | null) => {
      const id = raw != null ? Number.parseInt(String(raw), 10) : NaN;
      if (Number.isNaN(id) || id <= 0) {
        this.router.navigate(['/cars']);
        return;
      }
      this.fetch(id);
    };
    const snap = this.route.snapshot.paramMap.get('id');
    tryFetch(snap);
  }

  fetch(id: number): void {
    this.loading = true;
    this.carService.get(id).subscribe({
      next: (car) => {
        this.car = car;
        this.loading = false;
        this.initGallery();
        try { this.cdr.detectChanges(); } catch {}
      },
      error: (err) => {
        this.error = err?.message ?? 'Falha ao carregar carro';
        this.loading = false;
        try { this.cdr.detectChanges(); } catch {}
      },
    });
  }

  ngOnDestroy(): void {
    this.stopRotation();
  }

  // --- Gallery helpers ---
  private initGallery(): void {
    this.stopRotation();
    this.currentIdx = 0;
    this.selectedIdx = null;
    const imgs = this.car?.images ?? [];
    if (imgs.length > 1) {
      // slight delay to ensure view is ready
      setTimeout(() => this.startRotation(), 0);
    }
  }

  private startRotation(): void {
    if (this.rotateTimer) return;
    this.zone.runOutsideAngular(() => {
      this.rotateTimer = setInterval(() => {
        if (typeof this.selectedIdx === 'number') return;
        const imgs = this.car?.images ?? [];
        if (!imgs || imgs.length < 2) return;
        const next = (this.currentIdx + 1) % imgs.length;
        this.zone.run(() => {
          this.currentIdx = next;
          try { this.cdr.detectChanges(); } catch {}
        });
      }, this.rotateMs);
    });
  }

  private stopRotation(): void {
    if (this.rotateTimer) {
      clearInterval(this.rotateTimer);
      this.rotateTimer = null;
    }
  }

  go(i: number, ev?: Event): void {
    const imgs = this.car?.images ?? [];
    if (i >= 0 && i < imgs.length) {
      // Toggle select/deselect. Selecting pauses rotation; deselecting resumes if not hovered
      if (this.selectedIdx === i) {
        this.selectedIdx = null;
        this.currentIdx = i; // resume from this image
        if (imgs.length > 1) this.restartRotation();
        // Remove focus ring when deselecting to clear the border
        const el = (ev?.currentTarget ?? ev?.target) as HTMLElement | undefined;
        try { el?.blur(); } catch {}
      } else {
        this.selectedIdx = i;
        this.currentIdx = i;
        this.stopRotation();
      }
      try { this.cdr.detectChanges(); } catch {}
    }
  }

  // Arrow navigation: select previous/next image (pauses rotation)
  prev(): void {
    const imgs = this.car?.images ?? [];
    if (!imgs || imgs.length < 2) return;
    const base = this.selectedIdx ?? this.currentIdx;
    const next = (base - 1 + imgs.length) % imgs.length;
    this.selectedIdx = next;
    this.currentIdx = next;
    this.stopRotation();
    try { this.cdr.detectChanges(); } catch {}
  }

  next(): void {
    const imgs = this.car?.images ?? [];
    if (!imgs || imgs.length < 2) return;
    const base = this.selectedIdx ?? this.currentIdx;
    const next = (base + 1) % imgs.length;
    this.selectedIdx = next;
    this.currentIdx = next;
    this.stopRotation();
    try { this.cdr.detectChanges(); } catch {}
  }

  togglePause(): void {
    const imgs = this.car?.images ?? [];
    if (!imgs || imgs.length < 2) return;
    if (this.selectedIdx !== null) {
      // resume
      this.selectedIdx = null;
      this.restartRotation();
    } else {
      // pause at current image
      const idx = this.currentIdx;
      this.selectedIdx = idx;
      this.stopRotation();
    }
    try { this.cdr.detectChanges(); } catch {}
  }

  private restartRotation(): void {
    this.stopRotation();
    this.startRotation();
  }

  // --- Lightbox ---
  openOverlay(startIndex?: number): void {
    const imgs = this.car?.images ?? [];
    if (!imgs || imgs.length === 0) return;
    const idx = (startIndex ?? (this.selectedIdx ?? this.currentIdx));
    this.overlayIdx = Math.max(0, Math.min(idx, imgs.length - 1));
    this.overlayOpen = true;
    this.overlayGrid = false;
    this.stopRotation();
    try { this.cdr.detectChanges(); } catch {}
  }

  closeOverlay(): void {
    this.overlayOpen = false;
    // when closing, continue slideshow from the last viewed image if not selected
    const imgs = this.car?.images ?? [];
    if (imgs && imgs.length > 0) {
      this.currentIdx = Math.max(0, Math.min(this.overlayIdx, imgs.length - 1));
    }
    if (this.selectedIdx === null && imgs.length > 1) {
      this.restartRotation();
    }
    try { this.cdr.detectChanges(); } catch {}
  }

  overlayPrev(): void {
    const imgs = this.car?.images ?? [];
    if (!imgs || imgs.length < 2) return;
    this.overlayIdx = (this.overlayIdx - 1 + imgs.length) % imgs.length;
    try { this.cdr.detectChanges(); } catch {}
  }

  overlayNext(): void {
    const imgs = this.car?.images ?? [];
    if (!imgs || imgs.length < 2) return;
    this.overlayIdx = (this.overlayIdx + 1) % imgs.length;
    try { this.cdr.detectChanges(); } catch {}
  }

  toggleOverlayGrid(): void {
    this.overlayGrid = !this.overlayGrid;
    try { this.cdr.detectChanges(); } catch {}
  }

  @HostListener('document:keydown', ['$event'])
  onDocKey(e: KeyboardEvent): void {
    if (!this.overlayOpen) return;
    if (e.key === 'Escape') { this.closeOverlay(); return; }
    if (e.key === 'ArrowLeft') { this.overlayPrev(); return; }
    if (e.key === 'ArrowRight') { this.overlayNext(); return; }
  }
}
