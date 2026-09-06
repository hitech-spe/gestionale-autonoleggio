import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Subscription } from 'rxjs';
import { FleetTabComponent } from './tabs/fleet-tab/fleet-tab.component';
import { CustomersTabComponent } from './tabs/customers-tab/customers-tab.component';
import { InsuranceTabComponent } from './tabs/insurance-tab/insurance-tab.component';
import { InspectionTabComponent } from './tabs/inspection-tab/inspection-tab.component';
import { MaintenanceTabComponent } from './tabs/maintenance-tab/maintenance-tab.component';
import { RemindersTabComponent } from './tabs/reminders-tab/reminders-tab.component';
import { ContractsTabComponent } from './tabs/contracts-tab/contracts-tab.component';
import { VerbaliTabComponent } from './tabs/verbali-tab/verbali-tab.component';
import { SettingsTabComponent } from './tabs/settings-tab/settings-tab.component';
import { RentalService, Reminder } from '../../services/rental.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

import { CalendarTabComponent } from './tabs/calendar-tab/calendar-tab.component';

type Tab = 'calendar' | 'fleet' | 'insurance' | 'inspection' | 'maintenance' | 'customers' | 'reminders' | 'contracts' | 'verbali' | 'settings';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CalendarTabComponent,
    FleetTabComponent,
    CustomersTabComponent,
    InsuranceTabComponent,
    InspectionTabComponent,
    MaintenanceTabComponent,
    RemindersTabComponent,
    ContractsTabComponent,
    VerbaliTabComponent,
    SettingsTabComponent
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private rentalService = inject(RentalService);
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  company$ = this.authService.currentCompany$;

  isTrialExpired = false;
  isCompanySuspended = false;
  daysLeftInTrial = 14;

  currentTab: Tab = 'calendar';
  locations = ['Tutte', 'Mottola', 'Massafra', 'Grottaglie'];
  selectedLocation$ = new BehaviorSubject<string>('Tutte');

  async logout() {
    await this.authService.logout();
    await this.router.navigate(['/']);
  }

  insuranceSearchTerm = '';
  insuranceHighlightedId = '';

  inspectionSearchTerm = '';
  inspectionHighlightedId = '';

  // Early alert global notifications
  activeAlertsCount = 0;
  pendingPopupAlerts: Reminder[] = [];
  private shownAlertPopups = new Set<string>();
  private allReminders: Reminder[] = [];
  private remindersSub?: Subscription;
  private timerId?: any;

  // Technical expirations (insurance, inspections)
  expiringInsurances: any[] = [];
  expiringInspections: any[] = [];
  showScadenzeDetails = true;

  private vehiclesSub?: Subscription;
  private insurancesSub?: Subscription;
  private inspectionsSub?: Subscription;
  private companySub?: Subscription;

  private allVehicles: any[] = [];
  private allInsurances: any[] = [];
  private allInspections: any[] = [];

  ngOnInit() {
    // Subscribe to company branding updates to apply white-labeling colors dynamically
    this.companySub = this.company$.subscribe(company => {
      if (company) {
        if (company.primaryColor) {
          document.documentElement.style.setProperty('--accent', company.primaryColor);
        } else {
          document.documentElement.style.removeProperty('--accent');
        }
        if (company.secondaryColor) {
          document.documentElement.style.setProperty('--accent-hover', company.secondaryColor);
        } else {
          document.documentElement.style.removeProperty('--accent-hover');
        }

        // Dynamically load company locations if configured!
        if (company.locations && company.locations.length > 0) {
          this.locations = ['Tutte', ...company.locations];
        } else {
          this.locations = ['Tutte', 'Mottola', 'Massafra', 'Grottaglie']; // Fallback default locations
        }

        // Handle subscription & trial checks
        this.isCompanySuspended = company.status === 'suspended';

        if (company.status === 'trial') {
          const createdAt = (company.createdAt as any)?.toDate ? (company.createdAt as any).toDate() : new Date();
          const now = new Date();
          const differenceInTime = now.getTime() - createdAt.getTime();
          const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
          
          this.daysLeftInTrial = 14 - differenceInDays;
          if (this.daysLeftInTrial <= 0) {
            this.daysLeftInTrial = 0;
            this.isTrialExpired = true;
          } else {
            this.isTrialExpired = false;
          }
        } else {
          this.isTrialExpired = false;
        }
      } else {
        document.documentElement.style.removeProperty('--accent');
        document.documentElement.style.removeProperty('--accent-hover');
        this.locations = ['Tutte', 'Mottola', 'Massafra', 'Grottaglie'];
        this.isTrialExpired = false;
        this.isCompanySuspended = false;
      }
      this.cdr.detectChanges();
    });

    // Subscribe to reminders
    this.remindersSub = this.rentalService.getReminders().subscribe(reminders => {
      this.allReminders = reminders;
      this.recalculateAlerts();
      this.cdr.detectChanges();
    });

    // Subscribe to vehicles, insurances, inspections to compute auto-warnings
    this.vehiclesSub = this.rentalService.getVehicles().subscribe(vehicles => {
      this.allVehicles = vehicles;
      this.recalculateExpirations();
      this.cdr.detectChanges();
    });

    this.insurancesSub = this.rentalService.getInsurances().subscribe(insurances => {
      this.allInsurances = insurances;
      this.recalculateExpirations();
      this.cdr.detectChanges();
    });

    this.inspectionsSub = this.rentalService.getInspections().subscribe(inspections => {
      this.allInspections = inspections;
      this.recalculateExpirations();
      this.cdr.detectChanges();
    });

    // Check periodically (every 10 seconds for ultra-immediate detection) because time advances and alerts can become active
    this.timerId = setInterval(() => {
      this.recalculateAlerts();
      this.cdr.detectChanges();
    }, 10000);
  }

  ngOnDestroy() {
    if (this.remindersSub) {
      this.remindersSub.unsubscribe();
    }
    if (this.vehiclesSub) {
      this.vehiclesSub.unsubscribe();
    }
    if (this.insurancesSub) {
      this.insurancesSub.unsubscribe();
    }
    if (this.inspectionsSub) {
      this.inspectionsSub.unsubscribe();
    }
    if (this.companySub) {
      this.companySub.unsubscribe();
    }
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    // Clean up branding overrides upon dashboard destruction
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--accent-hover');
  }

  recalculateAlerts() {
    let count = 0;
    const now = Date.now();
    const newActiveAlerts: Reminder[] = [];

    for (const rem of this.allReminders) {
      if (rem.completed) continue;
      if (!rem.alertBeforeUnit || rem.alertBeforeUnit === 'none' || !rem.alertBeforeValue) continue;

      let offsetMs = 0;
      const val = rem.alertBeforeValue;
      switch (rem.alertBeforeUnit) {
        case 'minutes':
          offsetMs = val * 60 * 1000;
          break;
        case 'hours':
          offsetMs = val * 60 * 60 * 1000;
          break;
        case 'days':
          offsetMs = val * 24 * 60 * 60 * 1000;
          break;
      }

      const targetTime = rem.date.toDate().getTime();
      const alertTime = targetTime - offsetMs;

      if (now >= alertTime && now < targetTime) {
        count++;
        // If it's active and hasn't been shown as a popup modal in this session, queue it!
        if (rem.id && !this.shownAlertPopups.has(rem.id)) {
          this.shownAlertPopups.add(rem.id);
          this.pendingPopupAlerts.push(rem);
        }
      }
    }

    this.activeAlertsCount = count;
  }

  recalculateExpirations() {
    if (!this.allInsurances || !this.allInspections) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    thirtyDaysFromNow.setHours(23, 59, 59, 999);

    // Filter insurances expiring in 30 days or less (or already expired), excluding sold vehicles
    this.expiringInsurances = this.allInsurances.filter(ins => {
      if (!ins.expiryDate) return false;
      
      // If vehicle exists and status is Venduto, ignore
      if (ins.vehicleId && this.allVehicles.length > 0) {
        const v = this.allVehicles.find(x => x.id === ins.vehicleId);
        if (v && v.status === 'Venduto') return false;
      }
      
      const expiry = ins.expiryDate.toDate ? ins.expiryDate.toDate() : new Date(ins.expiryDate);
      return expiry <= thirtyDaysFromNow;
    });

    // Filter inspections expiring in 30 days or less (or already expired), excluding sold vehicles
    this.expiringInspections = this.allInspections.filter(insp => {
      if (!insp.expiryDate) return false;

      // If vehicle exists and status is Venduto, ignore
      if (insp.vehicleId && this.allVehicles.length > 0) {
        const v = this.allVehicles.find(x => x.id === insp.vehicleId);
        if (v && v.status === 'Venduto') return false;
      }

      const expiry = insp.expiryDate.toDate ? insp.expiryDate.toDate() : new Date(insp.expiryDate);
      return expiry <= thirtyDaysFromNow;
    });
  }

  isPastDate(timestamp: any): boolean {
    if (!timestamp) return false;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return date < now;
  }

  getDaysLeftText(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `scaduto da ${Math.abs(diffDays)} gg`;
    } else if (diffDays === 0) {
      return 'scade oggi';
    } else if (diffDays === 1) {
      return 'scade domani';
    } else {
      return `mancano ${diffDays} gg`;
    }
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  get currentPopupAlert(): Reminder | null {
    return this.pendingPopupAlerts.length > 0 ? this.pendingPopupAlerts[0] : null;
  }

  async completePopupAlert(reminder: Reminder) {
    if (!reminder.id) return;
    try {
      await this.rentalService.toggleReminderCompletion(reminder);
      this.dismissPopupAlert();
    } catch (error) {
      console.error('Errore nel completamento del promemoria da popup:', error);
    }
  }

  dismissPopupAlert() {
    if (this.pendingPopupAlerts.length > 0) {
      this.pendingPopupAlerts.shift(); // Remove the top of the queue
    }
  }

  formatAlertDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  onTabChange(tab: Tab) {
    this.currentTab = tab;
    // Clear filters and highlights when changing tabs manually
    if (tab === 'insurance') {
      this.insuranceSearchTerm = '';
      this.insuranceHighlightedId = '';
    } else if (tab === 'inspection') {
      this.inspectionSearchTerm = '';
      this.inspectionHighlightedId = '';
    }
  }

  getVehiclePlate(item: any): string {
    const v = this.allVehicles.find(x => x.id === item.vehicleId);
    if (v) return v.plate;
    if (item.vehiclePlate && item.vehiclePlate.includes('(') && item.vehiclePlate.includes(')')) {
      const parts = item.vehiclePlate.split('(');
      return parts[parts.length - 1].replace(')', '').trim();
    }
    return item.vehiclePlate || '';
  }

  navigateToInsurance(ins: any) {
    const plate = this.getVehiclePlate(ins);
    this.insuranceSearchTerm = plate;
    this.insuranceHighlightedId = ins.id || '';
    this.currentTab = 'insurance';

    // Auto-clear highlight after 5 seconds
    setTimeout(() => {
      if (this.insuranceHighlightedId === ins.id) {
        this.insuranceHighlightedId = '';
      }
    }, 5000);
  }

  navigateToInspection(insp: any) {
    const plate = this.getVehiclePlate(insp);
    this.inspectionSearchTerm = plate;
    this.inspectionHighlightedId = insp.id || '';
    this.currentTab = 'inspection';

    // Auto-clear highlight after 5 seconds
    setTimeout(() => {
      if (this.inspectionHighlightedId === insp.id) {
        this.inspectionHighlightedId = '';
      }
    }, 5000);
  }

  changeLocationFilter(loc: string) {
    this.selectedLocation$.next(loc);
  }
}
