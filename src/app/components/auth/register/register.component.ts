import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';

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

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  companyName = '';
  selectedPlan: 'starter' | 'pro' | 'enterprise' = 'starter';
  
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
      await this.authService.register(
        this.email,
        this.password,
        this.firstName,
        this.lastName,
        this.companyName,
        this.selectedPlan
      );
      // Success: redirect directly to the dashboard
      await this.router.navigate(['/app/dashboard']);
    } catch (err: any) {
      console.error(err);
      this.error = err.message || 'Errore durante la registrazione. Riprova.';
    } finally {
      this.isLoading = false;
      this.loadingService.hide();
    }
  }
}
