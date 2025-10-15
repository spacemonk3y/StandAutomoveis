import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs/operators';

export const httpLoggerInterceptor: HttpInterceptorFn = (req, next) => {
  const started = performance.now();
  // Basic dev logging
  // Avoid logging huge bodies
  console.log('[HTTP]', req.method, req.url);
  return next(req).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          const ms = Math.round(performance.now() - started);
          console.log('[HTTP OK]', req.method, req.url, event.status, `${ms}ms`);
        }
      },
      error: (err) => {
        const ms = Math.round(performance.now() - started);
        console.warn('[HTTP ERR]', req.method, req.url, `${ms}ms`, err);
      },
    })
  );
};

