import { Component, Inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.less'
})
export class App implements OnInit {
  protected readonly title = signal('app');
  year = new Date().getFullYear();
  theme = signal<'light' | 'dark'>('light');

  constructor(@Inject(DOCUMENT) private doc: Document) {
    // align initial client state with DOM set by index.html to avoid hydration mismatch
    try {
      const initial = (globalThis as any)?.__theme
        ?? this.doc?.documentElement?.getAttribute('data-theme')
        ?? 'light';
      this.theme.set(initial === 'dark' ? 'dark' : 'light');
    } catch {}
  }

  ngOnInit(): void {
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!isBrowser) return;
    try {
      const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
      this.theme.set(initial);
      this.applyTheme(initial);
      // Keep in sync with system pref if user hasn't chosen manually
      const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
      mq?.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          const next = e.matches ? 'dark' : 'light';
          this.theme.set(next);
          this.applyTheme(next);
        }
      });
    } catch {}
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    this.theme.set(next);
    this.applyTheme(next);
  }

  private applyTheme(mode: 'light' | 'dark'): void {
    const isBrowser = typeof document !== 'undefined';
    if (!isBrowser) return;
    document.documentElement.classList.toggle('theme-dark', mode === 'dark');
    document.documentElement.setAttribute('data-theme', mode);
  }
}
