import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, firstValueFrom } from 'rxjs';
import { AuthService, Company } from '../../../../services/auth.service';
import { LoadingService } from '../../../../services/loading.service';
import { API_CONFIG } from '../../../../config/api.config';

@Component({
  selector: 'app-settings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-tab.component.html',
  styleUrls: ['./settings-tab.component.scss']
})
export class SettingsTabComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private loadingService = inject(LoadingService);
  private http = inject(HttpClient);

  company$ = this.authService.currentCompany$;
  private companySub?: Subscription;

  // Local settings model
  settings = {
    name: '',
    primaryColor: '#2563eb',
    secondaryColor: '#1d4ed8',
    logoUrl: '',
    contactPhone: '',
    contactEmail: '',
    contactAddress: '',
    piva: '',
    locations: [] as string[],
    // Cargos credentials (separate secure endpoint)
    cargosUsername: '',
    cargosPassword: '',
    cargosApiKey: ''
  };

  logoPreview: string | null = null;
  companyId = '';
  newLocationName = '';
  saveSuccess = false;
  saveError = '';

  ngOnInit() {
    this.companySub = this.company$.subscribe(company => {
      if (company) {
        this.companyId = company.id;
        this.settings.name = company.name || '';
        this.settings.primaryColor = company.primaryColor || '#2563eb';
        this.settings.secondaryColor = company.secondaryColor || '#1d4ed8';
        this.settings.logoUrl = company.logoUrl || '';
        this.settings.contactPhone = company.contactPhone || '';
        this.settings.contactEmail = company.contactEmail || '';
        this.settings.contactAddress = company.contactAddress || '';
        this.settings.piva = company.piva || '';
        this.settings.locations = company.locations && company.locations.length > 0 
          ? [...company.locations] 
          : ['Mottola', 'Massafra', 'Grottaglie'];
        this.logoPreview = company.logoUrl || null;
      }
    });

    // Attempt to load current Cargos credentials from backend if they exist
    this.loadCargosCredentials();
  }

  ngOnDestroy() {
    if (this.companySub) {
      this.companySub.unsubscribe();
    }
  }

  addLocation() {
    const trimmed = this.newLocationName.trim();
    if (!trimmed) return;
    if (this.settings.locations.includes(trimmed)) {
      alert('Questa sede esiste già.');
      return;
    }
    this.settings.locations.push(trimmed);
    this.newLocationName = '';
  }

  removeLocation(loc: string) {
    this.settings.locations = this.settings.locations.filter(l => l !== loc);
  }

  async loadCargosCredentials() {
    try {
      // Endpoint that returns masked or existing integration configs
      const creds = await firstValueFrom(
        this.http.get<any>(`${API_CONFIG.baseUrl}/api/company/settings/credentials`)
      );
      if (creds) {
        this.settings.cargosUsername = creds.cargosUsername || '';
        // Password is left empty or masked for safety
        this.settings.cargosPassword = creds.hasPassword ? '••••••••' : '';
        this.settings.cargosApiKey = creds.cargosApiKey || '';
      }
    } catch (e) {
      console.log('Nessuna credenziale Cargos pre-esistente trovata.');
    }
  }

  onLogoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Limit to 300KB to ensure smooth Base64 storage on Firestore document limits
    const maxSizeBytes = 300 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`Il logo è troppo grande (${(file.size / 1024).toFixed(0)} KB). Si prega di caricare un logo inferiore a 300 KB per garantire prestazioni ottimali.`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      this.logoPreview = base64;
      this.settings.logoUrl = base64;
    };
  }

  removeLogo() {
    this.logoPreview = null;
    this.settings.logoUrl = '';
  }

  async saveSettings() {
    this.saveSuccess = false;
    this.saveError = '';

    if (!this.settings.name) {
      this.saveError = 'Il nome della società è obbligatorio.';
      return;
    }

    try {
      this.loadingService.show();

      // 1. Send both branding and cargos config to the Spring Boot Backend secure endpoint
      await firstValueFrom(
        this.http.post(`${API_CONFIG.baseUrl}/api/company/settings`, this.settings)
      );

      // 2. Update local cached frontend state for real-time reactivity
      const brandingData: Partial<Company> = {
        name: this.settings.name,
        primaryColor: this.settings.primaryColor,
        secondaryColor: this.settings.secondaryColor,
        logoUrl: this.settings.logoUrl,
        contactPhone: this.settings.contactPhone,
        contactEmail: this.settings.contactEmail,
        contactAddress: this.settings.contactAddress,
        piva: this.settings.piva,
        locations: this.settings.locations
      };
      
      await this.authService.updateCompanySettings(this.companyId, brandingData);

      this.loadingService.hide();
      this.saveSuccess = true;
      setTimeout(() => this.saveSuccess = false, 5000);
    } catch (e: any) {
      this.loadingService.hide();
      console.error('Errore durante il salvataggio:', e);
      this.saveError = e.error?.error || 'Si è verificato un errore imprevisto durante il salvataggio dei dati.';
    }
  }
}
