import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private loadingService = inject(LoadingService);
  private router = inject(Router);
  private http = inject(HttpClient);

  email = '';
  password = '';
  error = '';
  isLoading = false;

  // Google Onboarding states
  companyName = '';
  location = '';
  selectedPlan: 'starter' | 'pro' | 'enterprise' = 'starter';
  subscribeImmediately = true;
  onboardingUser$ = this.authService.googleOnboardingUser$;

  async onSubmit() {
    if (!this.email || !this.password) {
      this.error = 'Inserisci email e password per continuare.';
      return;
    }

    this.isLoading = true;
    this.loadingService.show();
    this.error = '';

    try {
      await this.authService.login(this.email, this.password);
      await this.router.navigate(['/app/dashboard']);
    } catch (err: any) {
      console.error(err);
      this.error = 'Credenziali non valide. Riprova.';
    } finally {
      this.isLoading = false;
      this.loadingService.hide();
    }
  }

  async loginWithGoogle() {
    this.isLoading = true;
    this.loadingService.show();
    this.error = '';

    try {
      const result = await this.authService.loginWithGoogle();
      if (result.isNewUser) {
        // They need onboarding! Do NOT navigate to the dashboard.
        // The auth service has already emitted the onboarding user, opening the modal.
        this.error = '';
      } else {
        // Existing user! Go to dashboard.
        await this.router.navigate(['/app/dashboard']);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        this.error = 'Accesso con Google annullato.';
      } else {
        this.error = 'Impossibile accedere con Google. Riprova.';
      }
    } finally {
      this.isLoading = false;
      this.loadingService.hide();
    }
  }

  async onboardGoogle() {
    if (!this.companyName) {
      this.error = 'Il nome dell\'azienda è obbligatorio.';
      return;
    }

    this.isLoading = true;
    this.loadingService.show();
    this.error = '';

    try {
      const response = await this.authService.onboardGoogleUser(this.companyName, '', this.selectedPlan, this.subscribeImmediately);

      // If Stripe Checkout is requested immediately, redirect to Stripe
      if (this.subscribeImmediately) {
        if (response && response.sessionUrl) {
          window.location.href = response.sessionUrl;
          return;
        } else {
          // If the onboarding endpoint didn't generate a checkout session, create one manually (like in register)
          try {
            const checkoutRes = await firstValueFrom(
              this.http.post<any>(`${API_CONFIG.baseUrl}/api/subscription/create-checkout-session`, { plan: this.selectedPlan })
            );
            if (checkoutRes && checkoutRes.sessionUrl) {
              this.loadingService.hide();
              window.location.href = checkoutRes.sessionUrl;
              return;
            }
          } catch (checkoutErr) {
            console.error("Errore avvio Stripe post-onboarding Google:", checkoutErr);
          }
        }
      }

      await this.router.navigate(['/app/dashboard']);
    } catch (err: any) {
      console.error(err);
      this.error = 'Impossibile configurare l\'azienda. Riprova.';
    } finally {
      this.isLoading = false;
      this.loadingService.hide();
    }
  }

  cancelOnboarding() {
    this.authService.googleOnboardingUser$.next(null);
    this.authService.logout();
    this.companyName = '';
    this.location = '';
  }
}
