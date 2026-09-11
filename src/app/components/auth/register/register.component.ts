import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  private authService = inject(AuthService);
  private loadingService = inject(LoadingService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  companyName = '';
  selectedPlan: 'starter' | 'pro' | 'enterprise' = 'starter';
  subscribeImmediately = true; // Choose whether to start with free trial or pay on registration submit
  
  error = '';
  isLoading = false;

  ngOnInit() {
    // Prefill plan based on query parameter
    this.route.queryParams.subscribe(params => {
      const planParam = params['plan'];
      if (planParam === 'starter' || planParam === 'pro' || planParam === 'enterprise') {
        this.selectedPlan = planParam;
      }
    });
  }

  async onSubmit() {
    if (!this.firstName || !this.lastName || !this.email || !this.password || !this.companyName) {
      this.error = 'Compila tutti i campi obbligatori per procedere.';
      return;
    }

    if (this.password.length < 6) {
      this.error = 'La password deve contenere almeno 6 caratteri.';
      return;
    }

    this.isLoading = true;
    this.loadingService.show();
    this.error = '';

    try {
      // 1. Fire registration request
      await this.authService.register(
        this.email,
        this.password,
        this.firstName,
        this.lastName,
        this.companyName,
        this.selectedPlan
      );
      
      // 2. If immediate subscription is active, redirect to Stripe checkout directly
      if (this.subscribeImmediately) {
        try {
          const response = await firstValueFrom(
            this.http.post<any>(`${API_CONFIG.baseUrl}/api/subscription/create-checkout-session`, { plan: this.selectedPlan })
          );
          this.loadingService.hide();
          if (response && response.sessionUrl) {
            window.location.href = response.sessionUrl;
            return;
          }
        } catch (checkoutErr) {
          console.error("Errore avvio Stripe post-registrazione, reindirizzo a dashboard:", checkoutErr);
        }
      }

      // 3. Fallback: redirect directly to the dashboard (loads free trial mode)
      this.loadingService.hide();
      await this.router.navigate(['/app/dashboard']);
    } catch (err: any) {
      this.loadingService.hide();
      console.error(err);
      this.error = err.message || 'Errore durante la registrazione. Riprova.';
    } finally {
      this.isLoading = false;
    }
  }

  async loginWithGoogle() {
    this.isLoading = true;
    this.loadingService.show();
    this.error = '';

    try {
      const result = await this.authService.loginWithGoogle();
      if (result.isNewUser) {
        // Redirect to login page where the onboarding modal can be displayed
        await this.router.navigate(['/auth/login']);
      } else {
        await this.router.navigate(['/app/dashboard']);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        this.error = 'Registrazione con Google annullata.';
      } else {
        this.error = 'Impossibile completare l\'operazione con Google. Riprova.';
      }
    } finally {
      this.isLoading = false;
      this.loadingService.hide();
    }
  }
}
