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
    // Feature flags activation states
    enableCargos: false,
    enableVerbaliPec: false,
    pecEmail: '',
    pecPassword: '',
    // Cargos credentials (separate secure endpoint)
    cargosUsername: '',
    cargosPassword: '',
    cargosApiKey: ''  ,
    // Customizable Calendar Colors
    colorStart: '#10b981',
    colorEnd: '#ef4444',
    colorSameDay: '#f97316',
    colorMaintenance: '#64748b',
    colorService: '#a855f7',
    colorSold: '#0f172a',
    termsPdfUrl: ''
  };

  activeSettingsSubTab = 'profile'; // 'profile' | 'branding' | 'integrations' | 'billing'
  logoPreview: string | null = null;
  termsPdfPreview: string | null = null;
  companyId = '';
  newLocationName = '';
  saveSuccess = false;
  saveError = '';

  // Billing states
  daysLeftInTrial = 14;
  companyStatus = 'trial';
  companyPlan = 'starter';

  ngOnInit() {
    this.companySub = this.company$.subscribe(company => {
      if (company) {
        this.companyId = company.id;
        this.companyStatus = company.status || 'trial';
        this.companyPlan = company.plan || 'starter';
        this.settings.name = company.name || '';
        this.settings.primaryColor = company.primaryColor || '#2563eb';
        this.settings.secondaryColor = company.secondaryColor || '#1d4ed8';
        this.settings.logoUrl = company.logoUrl || '';
        this.settings.contactPhone = company.contactPhone || '';
        this.settings.contactEmail = company.contactEmail || '';
        this.settings.contactAddress = company.contactAddress || '';
        this.settings.piva = company.piva || '';
        this.settings.locations = company.locations ? [...company.locations] : [];
        this.logoPreview = company.logoUrl || null;
        this.settings.termsPdfUrl = (company as any).termsPdfUrl || '';
        this.termsPdfPreview = (company as any).termsPdfUrl || null;
        this.settings.enableCargos = company.enableCargos || false;
        this.settings.enableVerbaliPec = company.enableVerbaliPec || false;
        this.settings.pecEmail = company.pecEmail || '';
        
        // Load customized calendar colors if they exist
        this.settings.colorStart = (company as any).colorStart || '#10b981';
        this.settings.colorEnd = (company as any).colorEnd || '#ef4444';
        this.settings.colorSameDay = (company as any).colorSameDay || '#f97316';
        this.settings.colorMaintenance = (company as any).colorMaintenance || '#64748b';
        this.settings.colorService = (company as any).colorService || '#a855f7';
        this.settings.colorSold = (company as any).colorSold || '#0f172a';

        // Calculate trial days remaining
        if (company.status === 'trial') {
          const createdAt = (company.createdAt as any)?.toDate ? (company.createdAt as any).toDate() : new Date();
          const now = new Date();
          const differenceInTime = now.getTime() - createdAt.getTime();
          const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
          this.daysLeftInTrial = 14 - differenceInDays;
          if (this.daysLeftInTrial < 0) this.daysLeftInTrial = 0;
        }
      }
    });

    // Attempt to load current external credentials from backend if they exist
    this.loadExternalCredentials();
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

  async loadExternalCredentials() {
    try {
      // Endpoint that returns masked or existing integration configs
      const creds = await firstValueFrom(
        this.http.get<any>(`${API_CONFIG.baseUrl}/api/company/settings/credentials`)
      );
      if (creds) {
        this.settings.cargosUsername = creds.cargosUsername || '';
        this.settings.cargosPassword = creds.hasCargosPassword ? '••••••••' : '';
        this.settings.cargosApiKey = creds.cargosApiKey || '';
        this.settings.pecEmail = creds.pecEmail || '';
        this.settings.pecPassword = creds.hasPecPassword ? '••••••••' : '';
      }
    } catch (e) {
      console.log('Nessuna credenziale pre-esistente trovata.');
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

  onTermsPdfSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Si prega di caricare esclusivamente file in formato PDF.');
      event.target.value = '';
      return;
    }

    // Limit to 500KB to ensure smooth Base64 storage on Firestore document limits
    const maxSizeBytes = 500 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`Il file PDF è troppo grande (${(file.size / 1024).toFixed(0)} KB). Si prega di caricare un documento inferiore a 500 KB.`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      this.termsPdfPreview = base64;
      this.settings.termsPdfUrl = base64;
    };
  }

  removeTermsPdf() {
    this.termsPdfPreview = null;
    this.settings.termsPdfUrl = '';
  }

  async createCheckoutSession(plan: 'starter' | 'pro' | 'enterprise') {
    try {
      this.loadingService.show();
      const response = await firstValueFrom(
        this.http.post<any>(`${API_CONFIG.baseUrl}/api/subscription/create-checkout-session`, { plan })
      );
      this.loadingService.hide();
      if (response && response.sessionUrl) {
        window.location.href = response.sessionUrl;
      }
    } catch (err: any) {
      this.loadingService.hide();
      console.error('Errore creazione sessione Stripe Checkout:', err);
      alert("Si è verificato un errore durante l'avvio del pagamento. Riprova più tardi.");
    }
  }

  async openCustomerPortal() {
    try {
      this.loadingService.show();
      const response = await firstValueFrom(
        this.http.post<any>(`${API_CONFIG.baseUrl}/api/subscription/customer-portal`, {})
      );
      this.loadingService.hide();
      if (response && response.portalUrl) {
        window.open(response.portalUrl, '_blank');
      }
    } catch (err: any) {
      this.loadingService.hide();
      console.error('Errore creazione sessione Portale Clienti Stripe:', err);
      alert("Si è verificato un errore durante l'apertura dell'area fatturazione. Se non hai ancora effettuato il primo pagamento, questa opzione non è disponibile.");
    }
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

      // 1. Send both branding, custom colors, and config to the Spring Boot Backend secure endpoint
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
        locations: this.settings.locations,
        enableCargos: this.settings.enableCargos,
        enableVerbaliPec: this.settings.enableVerbaliPec,
        pecEmail: this.settings.pecEmail,
        // Customized Calendar Colors
        colorStart: this.settings.colorStart,
        colorEnd: this.settings.colorEnd,
        colorSameDay: this.settings.colorSameDay,
        colorMaintenance: this.settings.colorMaintenance,
        colorService: this.settings.colorService,
        colorSold: this.settings.colorSold,
        termsPdfUrl: (this.settings as any).termsPdfUrl
      } as any;
      
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
