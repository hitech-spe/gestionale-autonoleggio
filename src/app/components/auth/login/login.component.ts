import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';

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

  email = '';
  password = '';
  error = '';
  isLoading = false;

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
}
