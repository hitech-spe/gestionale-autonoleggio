import { Component, HostListener, inject, ElementRef } from '@angular/core';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import {Router, RouterLink} from '@angular/router';
import { NgOptimizedImage, AsyncPipe } from '@angular/common'; // <-- Aggiunto AsyncPipe
import { AuthService } from "../../services/auth.service";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [TranslateModule, RouterLink, NgOptimizedImage, AsyncPipe], // <-- Aggiunto qui
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  private translate = inject(TranslateService);
  private authService = inject(AuthService);
  private eRef = inject(ElementRef); // <-- Serve per chiudere il menu cliccando fuori
  private router = inject(Router);

  isScrolled = false;
  isMenuOpen = false;
  isServicesOpenMobile = false;
  isUserMenuOpen = false; // <-- Nuova variabile

  user$ = this.authService.user$;

  get currentLang(): string {
    return this.translate.currentLang || 'it';
  }

  async logout() {
    this.authService.logout();
    this.closeMenu();
    this.isUserMenuOpen = false;
    await this.router.navigate(['/home']);
  }

  toggleUserMenu(event: Event) {
    event.stopPropagation(); // Evita che il click chiuda subito il menu
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  // Chiude il menu utente se si clicca fuori
  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    if (this.isUserMenuOpen && !this.eRef.nativeElement.contains(event.target)) {
      this.isUserMenuOpen = false;
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
    this.isServicesOpenMobile = false;
  }

  toggleServicesMobile(event: Event) {
    if (window.innerWidth <= 992) {
      event.preventDefault();
      this.isServicesOpenMobile = !this.isServicesOpenMobile;
    }
  }

  changeLang(lang: string) {
    this.translate.use(lang);
  }
}
