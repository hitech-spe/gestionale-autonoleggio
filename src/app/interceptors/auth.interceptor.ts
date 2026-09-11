import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth, user, getIdToken } from '@angular/fire/auth';
import { from, switchMap, take } from 'rxjs';

/**
 * Intercettore HTTP che recupera in modo sicuro ed asincrono il Firebase ID Token,
 * prevenendo race-condition temporanee dovute al caricamento in background di Firebase Auth.
 * Aggiunge il token come Bearer nell'header 'Authorization' per tutte le chiamate Spring Boot.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);

  // Salta l'aggiunta dell'header per gli endpoint pubblici di autenticazione o file locali
  if (req.url.includes('/api/auth/') || req.url.includes('/assets/')) {
    return next(req);
  }

  // Utilizza l'observable asincrono 'user(auth)' fornito da AngularFire.
  // Questo previene race condition dovute al fatto che 'auth.currentUser' potrebbe essere null
  // sincronicamente durante l'inizializzazione dell'app, anche se l'utente è regolarmente connesso.
  return user(auth).pipe(
    take(1),
    switchMap(currentUser => {
      if (currentUser) {
        return from(getIdToken(currentUser)).pipe(
          switchMap(token => {
            const cloned = req.clone({
              setHeaders: {
                Authorization: `Bearer ${token}`
              }
            });
            return next(cloned);
          })
        );
      }
      // Se l'utente non è ancora loggato o è anonimo, prosegue normalmente
      return next(req);
    })
  );
};
