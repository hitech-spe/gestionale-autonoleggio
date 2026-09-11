import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, BehaviorSubject, switchMap, tap } from 'rxjs';
import { Insurance, Inspection, Maintenance, RentalService, Vehicle } from '../../../../services/rental.service';
import { LoadingService } from '../../../../services/loading.service';
import { AuthService } from '../../../../services/auth.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-fleet-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fleet-tab.component.html'
})
export class FleetTabComponent implements OnInit {
  @Input() selectedLocation$!: BehaviorSubject<string>;

  private rentalService = inject(RentalService);
  private loadingService = inject(LoadingService);
  private authService = inject(AuthService);

  get locations(): string[] {
    return this.authService.companyLocations;
  }

  searchTerm = '';
  sortOrder: 'newest' | 'oldest' | 'brand' | 'category' = 'newest';

  readonly CATEGORY_ORDER = [
    'A', 'B', 'C', 'D', 'E', 'F', '7 posti', 'Van 9 posti', 
    'L1H1', 'L2H1', 'L2H2', 'L3H3', 'L4H3', 'Cassa quadrata',
    'Cassone aperto 3 posti', 'Cassone aperto 7 posti', 
    'Sponda idraulica', 'Refrigerato', 'Ribaltabile', 'ILVA'
  ];

  vehicles$!: Observable<Vehicle[]>;
  vehicles: Vehicle[] = [];
  limitReached = false;

  isModalOpen = false;
  isEditMode = false;
  editingVehicleId?: string;

  newVehicle: Partial<Vehicle> = { location: '', status: 'Attivo', category: 'A' };
  categories: string[] = ['A', 'B', 'C', 'D', 'E', 'F', '7 posti', 'Van 9 posti', 'L1H1', 'L2H1', 'L2H2', 'L3H3', 'L4H3', 'Cassa quadrata', 'Cassone aperto 3 posti', 'Cassone aperto 7 posti', 'Sponda idraulica', 'Refrigerato', 'Ribaltabile', 'ILVA'];

  // Dettagli opzionali per nuovo veicolo
  newInsurance: Partial<Insurance> = {};
  newInspection: Partial<Inspection> = {};
  newMaintenance: Partial<Maintenance> = {};

  // Campi helper per le date (input type="date" richiede stringa YYYY-MM-DD)
  insuranceExpiryDate = '';
  inspectionExpiryDate = '';
  maintenanceDate = '';

  // Storico Lavorazioni Veicolo
  allMaintenances: Maintenance[] = [];
  vehicleMaintenances: Maintenance[] = [];
  inlineMaintenance: any = { description: '', date: '', cost: null, km: null, workshop: '' };

  // Scheda Lavori Stampabile
  isJobSheetOpen = false;
  selectedVehicleForSheet: any = null;
  sheetMaintenances: Maintenance[] = [];
  todayDate = new Date();
  sheetInlineMaintenance: any = { description: '', date: '', cost: null, km: null, workshop: '' };

  ngOnInit() {
    this.loadingService.show();
    this.vehicles$ = this.selectedLocation$.pipe(
      switchMap(loc => this.rentalService.getVehicles(loc === 'Tutte' ? undefined : loc)),
      tap({
        next: (list) => {
          this.vehicles = list || [];
          this.loadingService.hide();
        },
        error: (err) => {
          console.error('Error loading vehicles:', err);
          this.loadingService.hide();
        }
      })
    );
    this.rentalService.getMaintenances().subscribe(m => {
      this.allMaintenances = m;
      if (this.editingVehicleId) {
        this.updateVehicleMaintenances();
      }
      if (this.selectedVehicleForSheet) {
        this.sheetMaintenances = m.filter(x => x.vehicleId === this.selectedVehicleForSheet.id);
      }
    });
  }

  updateVehicleMaintenances() {
    this.vehicleMaintenances = this.allMaintenances.filter(m => m.vehicleId === this.editingVehicleId);
  }

  async openModal(vehicle?: Vehicle) {
    if (vehicle) {
      this.isEditMode = true;
      this.editingVehicleId = vehicle.id;
      this.newVehicle = { ...vehicle };
      this.updateVehicleMaintenances();
      this.limitReached = false; // Modifying an existing vehicle doesn't increase flotta count!

      // Carica dettagli correlati più recenti
      if (vehicle.id) {
        try {
          this.loadingService.show();
          const [ins, insp, maint] = await Promise.all([
            this.rentalService.getLatestInsurance(vehicle.id),
            this.rentalService.getLatestInspection(vehicle.id),
            this.rentalService.getLatestMaintenance(vehicle.id)
          ]);

          if (ins) {
            this.newInsurance = { ...ins };
            this.insuranceExpiryDate = (ins.expiryDate as any).toDate().toISOString().split('T')[0];
          } else {
            this.newInsurance = {};
            this.insuranceExpiryDate = '';
          }

          if (insp) {
            this.newInspection = { ...insp };
            this.inspectionExpiryDate = (insp.expiryDate as any).toDate().toISOString().split('T')[0];
          } else {
            this.newInspection = {};
            this.inspectionExpiryDate = '';
          }

          if (maint) {
            this.newMaintenance = { ...maint };
            this.maintenanceDate = (maint.date as any).toDate().toISOString().split('T')[0];
          } else {
            this.newMaintenance = {};
            this.maintenanceDate = '';
          }
          this.loadingService.hide();
        } catch (error) {
          this.loadingService.hide();
          console.error('Errore durante il caricamento dei dettagli del veicolo:', error);
        }
      }
    } else {
      this.isEditMode = false;
      this.editingVehicleId = undefined;
      this.newVehicle = { location: this.locations[0] || '', status: 'Attivo', category: 'A' };
      this.vehicleMaintenances = [];
      this.newInsurance = {};
      this.newInspection = {};
      this.newMaintenance = {};
      this.insuranceExpiryDate = '';
      this.inspectionExpiryDate = '';
      this.maintenanceDate = '';
      this.inlineMaintenance = { description: '', date: '', cost: null, km: null, workshop: '' };

      // Enforce SaaS pricing plan limits
      const plan = this.authService.getCompanyPlan();
      const currentCount = this.vehicles.length;
      if (plan === 'starter' && currentCount >= 5) {
        this.limitReached = true;
      } else if (plan === 'pro' && currentCount >= 20) {
        this.limitReached = true;
      } else {
        this.limitReached = false;
      }
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.newVehicle = { location: this.locations[0] || '', status: 'Attivo', category: 'A' };
  }

  async saveVehicle() {
    if (!this.newVehicle.brand || !this.newVehicle.plate) return;

    try {
      this.loadingService.show();
      // Conversione date in Timestamp (valido sia per add che per update)
      if (this.insuranceExpiryDate) {
        this.newInsurance.expiryDate = Timestamp.fromDate(new Date(this.insuranceExpiryDate));
      }
      if (this.inspectionExpiryDate) {
        this.newInspection.expiryDate = Timestamp.fromDate(new Date(this.inspectionExpiryDate));
      }
      if (this.maintenanceDate) {
        this.newMaintenance.date = Timestamp.fromDate(new Date(this.maintenanceDate));
      }

      if (this.isEditMode && this.editingVehicleId) {
        await this.rentalService.updateVehicleWithDetails(
          this.editingVehicleId,
          this.newVehicle,
          this.newInsurance,
          this.newInspection,
          this.newMaintenance
        );
      } else {
        await this.rentalService.addVehicleWithDetails(
          this.newVehicle as Vehicle,
          this.newInsurance,
          this.newInspection,
          this.newMaintenance
        );
      }
      this.loadingService.hide();
      this.closeModal();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante il salvataggio del veicolo:', error);
      alert('Si è verificato un errore durante il salvataggio del veicolo.');
    }
  }

  async deleteVehicle(id: string) {
    if (confirm('ATTENZIONE: Eliminando questo veicolo verranno eliminati anche tutti i noleggi, assicurazioni, revisioni e manutenzioni collegati. Sei sicuro di voler procedere?')) {
      try {
        this.loadingService.show();
        await this.rentalService.deleteVehicle(id);
        this.loadingService.hide();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore durante l\'eliminazione del veicolo:', error);
        alert('Si è verificato un errore durante l\'eliminazione del veicolo.');
      }
    }
  }

  getFiltered(items: Vehicle[] | null): Vehicle[] {
    if (!items) return [];
    let filtered = items
        .filter(i => {
          const brand = i.brand?.toLowerCase() || '';
          const model = i.model?.toLowerCase() || '';
          const plate = i.plate?.toLowerCase() || '';
          const term = this.searchTerm.toLowerCase();
          
          return brand.includes(term) || 
                 model.includes(term) || 
                 plate.includes(term);
        });

    // Applica ordinamento scelto dall'utente
    return filtered.sort((a, b) => {
      if (this.sortOrder === 'newest') {
        const dateA = (a.createdAt as any)?.seconds || 0;
        const dateB = (b.createdAt as any)?.seconds || 0;
        return dateB - dateA;
      } else if (this.sortOrder === 'oldest') {
        const dateA = (a.createdAt as any)?.seconds || 0;
        const dateB = (b.createdAt as any)?.seconds || 0;
        return dateA - dateB;
      } else if (this.sortOrder === 'category') {
        const indexA = this.CATEGORY_ORDER.indexOf(a.category);
        const indexB = this.CATEGORY_ORDER.indexOf(b.category);
        if (indexA === -1 && indexB === -1) return a.category.localeCompare(b.category);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      } else {
        return a.brand.localeCompare(b.brand);
      }
    });
  }

  async addInlineMaintenance() {
    if (!this.editingVehicleId || !this.inlineMaintenance.description || !this.inlineMaintenance.date) return;
    try {
      this.loadingService.show();
      const v = this.newVehicle;
      const data: Maintenance = {
        vehicleId: this.editingVehicleId,
        vehiclePlate: v ? `${v.brand} ${v.model} (${v.plate})` : '?',
        description: this.inlineMaintenance.description,
        date: Timestamp.fromDate(new Date(this.inlineMaintenance.date)),
        cost: this.inlineMaintenance.cost || 0,
        km: this.inlineMaintenance.km || null,
        workshop: this.inlineMaintenance.workshop || ''
      };

      await this.rentalService.addMaintenance(data);
      this.loadingService.hide();
      this.inlineMaintenance = { description: '', date: '', cost: null, km: null, workshop: '' };
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante l\'aggiunta della lavorazione:', error);
      alert('Si è verificato un errore.');
    }
  }

  async deleteInlineMaintenance(id: string) {
    if (confirm('Sei sicuro di voler eliminare questa lavorazione dallo storico?')) {
      try {
        this.loadingService.show();
        await this.rentalService.deleteMaintenance(id);
        this.loadingService.hide();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore durante l\'eliminazione della manutenzione:', error);
        alert('Si è verificato un errore.');
      }
    }
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString('it-IT');
    return new Date(timestamp).toLocaleDateString('it-IT');
  }

  openJobSheet(vehicle: Vehicle) {
    this.selectedVehicleForSheet = vehicle;
    this.sheetMaintenances = this.allMaintenances.filter(m => m.vehicleId === vehicle.id);
    this.todayDate = new Date();
    this.isJobSheetOpen = true;
  }

  closeJobSheet() {
    this.isJobSheetOpen = false;
    this.selectedVehicleForSheet = null;
    this.sheetMaintenances = [];
  }

  getSheetTotalCost(): number {
    return this.sheetMaintenances.reduce((sum, m) => sum + (m.cost || 0), 0);
  }

  getMaxKm(): string {
    const kms = this.sheetMaintenances.map(m => m.km || 0).filter(k => k > 0);
    if (kms.length === 0) return '-';
    return Math.max(...kms).toLocaleString('it-IT');
  }

  printJobSheet() {
    if (!this.selectedVehicleForSheet) return;
    const printContent = document.getElementById('printable-job-sheet')?.innerHTML;
    if (printContent) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Foglio Lavori - ${this.selectedVehicleForSheet.brand} ${this.selectedVehicleForSheet.model} (${this.selectedVehicleForSheet.plate})</title>
              <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 3rem; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
                th, td { border: 1px solid #eee; padding: 10px; font-size: 0.85rem; text-align: left; }
                th { background: #f8f9fa; font-weight: bold; }
              </style>
            </head>
            <body onload="window.print(); window.close();">
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  }

  async addJobFromSheet() {
    if (!this.selectedVehicleForSheet || !this.sheetInlineMaintenance.description || !this.sheetInlineMaintenance.date) return;
    try {
      this.loadingService.show();
      const v = this.selectedVehicleForSheet;
      const data: Maintenance = {
        vehicleId: v.id,
        vehiclePlate: `${v.brand} ${v.model} (${v.plate})`,
        description: this.sheetInlineMaintenance.description,
        date: Timestamp.fromDate(new Date(this.sheetInlineMaintenance.date)),
        cost: this.sheetInlineMaintenance.cost || 0,
        km: this.sheetInlineMaintenance.km || null,
        workshop: this.sheetInlineMaintenance.workshop || ''
      };

      await this.rentalService.addMaintenance(data);
      this.loadingService.hide();
      this.sheetInlineMaintenance = { description: '', date: '', cost: null, km: null, workshop: '' };
      
      this.sheetMaintenances = this.allMaintenances.filter(m => m.vehicleId === v.id);
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante l\'aggiunta della lavorazione:', error);
      alert('Si è verificato un errore.');
    }
  }

  editingJobId: string | null = null;
  tempEditingJob: any = {};

  startEditJob(job: Maintenance) {
    this.editingJobId = job.id || null;
    this.tempEditingJob = { ...job };
  }

  cancelEditJob() {
    this.editingJobId = null;
    this.tempEditingJob = {};
  }

  async saveEditedJob() {
    if (!this.editingJobId || !this.tempEditingJob.description) return;
    try {
      this.loadingService.show();
      await this.rentalService.updateMaintenance(this.editingJobId, {
        description: this.tempEditingJob.description,
        km: this.tempEditingJob.km || null,
        cost: this.tempEditingJob.cost || 0,
        workshop: this.tempEditingJob.workshop || ''
      });
      this.loadingService.hide();
      this.cancelEditJob();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante la modifica:', error);
      alert('Si è verificato un errore durante la modifica.');
    }
  }
}
