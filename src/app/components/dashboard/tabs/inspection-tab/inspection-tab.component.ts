import { Component, OnInit, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, tap } from 'rxjs';
import { Inspection, RentalService, Vehicle } from '../../../../services/rental.service';
import { LoadingService } from '../../../../services/loading.service';
import { Timestamp } from '@angular/fire/firestore';
import { VehicleSelectComponent } from "../../../../shared/vehicle-select/vehicle-select.component";

@Component({
  selector: 'app-inspection-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, VehicleSelectComponent],
  templateUrl: './inspection-tab.component.html'
})
export class InspectionTabComponent implements OnInit {
  private rentalService = inject(RentalService);
  private loadingService = inject(LoadingService);

  inspections$!: Observable<Inspection[]>;
  availableVehicles: Vehicle[] = [];

  @Input() searchTerm = '';
  @Input() highlightedId = '';
  sortOrder: 'newest' | 'oldest' | 'expiryDate' = 'newest';

  isModalOpen = false;
  isEditMode = false;
  editingInspectionId?: string;
  newInspection: any = {};

  ngOnInit() {
    this.loadingService.show();
    this.inspections$ = this.rentalService.getInspections().pipe(
      tap({
        next: () => this.loadingService.hide(),
        error: (err) => {
          console.error('Error loading inspections:', err);
          this.loadingService.hide();
        }
      })
    );
    this.rentalService.getVehicles().subscribe(v => this.availableVehicles = v);
  }

  openModal(inspection?: Inspection) {
    if (inspection) {
      this.isEditMode = true;
      this.editingInspectionId = inspection.id;
      const expiryDate = inspection.expiryDate && (inspection.expiryDate as any).toDate ? (inspection.expiryDate as any).toDate().toISOString().split('T')[0] : '';
      this.newInspection = { 
        ...inspection,
        expiryDate: expiryDate
      };
    } else {
      this.isEditMode = false;
      this.editingInspectionId = undefined;
      this.newInspection = {};
    }
    this.isModalOpen = true;
  }

  closeModal() { this.isModalOpen = false; this.newInspection = {}; }

  async saveInspection() {
    if (!this.newInspection.vehicleId || !this.newInspection.expiryDate) return;
    try {
      this.loadingService.show();
      const v = this.availableVehicles.find(x => x.id === this.newInspection.vehicleId);
      const data: Inspection = {
        ...this.newInspection,
        vehiclePlate: v ? `${v.brand} ${v.model} (${v.plate})` : (this.newInspection.vehiclePlate || '?'),
        expiryDate: Timestamp.fromDate(new Date(this.newInspection.expiryDate))
      };

      if (this.isEditMode && this.editingInspectionId) {
        await this.rentalService.updateInspection(this.editingInspectionId, data);
      } else {
        await this.rentalService.addInspection(data);
      }
      this.loadingService.hide();
      this.closeModal();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante il salvataggio della revisione:', error);
      alert('Si è verificato un errore durante il salvataggio della revisione.');
    }
  }

  async deleteInspection(id: string) {
    if (confirm('Sei sicuro di voler eliminare questa revisione?')) {
      try {
        this.loadingService.show();
        await this.rentalService.deleteInspection(id);
        this.loadingService.hide();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore durante l\'eliminazione della revisione:', error);
        alert('Si è verificato un errore durante l\'eliminazione della revisione.');
      }
    }
  }

  private getTimeSeconds(val: any): number {
    if (!val) return 0;
    if (typeof val.seconds === 'number') {
      return val.seconds;
    }
    if (typeof val.toDate === 'function') {
      return Math.floor(val.toDate().getTime() / 1000);
    }
    const d = new Date(val);
    const time = d.getTime();
    return isNaN(time) ? 0 : Math.floor(time / 1000);
  }

  getFiltered(items: Inspection[] | null): Inspection[] {
    if (!items) return [];
    let filtered = items
      .filter(i => {
        const plate = i.vehiclePlate?.toLowerCase() || '';
        const term = this.searchTerm.toLowerCase();
        return plate.includes(term);
      });

    return filtered.sort((a, b) => {
      const expA = this.getTimeSeconds(a.expiryDate);
      const expB = this.getTimeSeconds(b.expiryDate);
      const createA = this.getTimeSeconds(a.createdAt) || expA;
      const createB = this.getTimeSeconds(b.createdAt) || expB;

      if (this.sortOrder === 'newest') {
        return createB - createA;
      } else if (this.sortOrder === 'oldest') {
        return createA - createB;
      } else {
        return expA - expB; // Scadenza più vicina in alto
      }
    });
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString('it-IT');
    return new Date(timestamp).toLocaleDateString('it-IT');
  }

  getVehicleName(vehicleId: string): string {
    const v = this.availableVehicles.find(x => x.id === vehicleId);
    return v ? `${v.brand} ${v.model}` : '';
  }

  getVehiclePlate(insp: Inspection): string {
    const v = this.availableVehicles.find(x => x.id === insp.vehicleId);
    if (v) return v.plate;
    if (insp.vehiclePlate && insp.vehiclePlate.includes('(') && insp.vehiclePlate.includes(')')) {
      const parts = insp.vehiclePlate.split('(');
      return parts[parts.length - 1].replace(')', '').trim();
    }
    return insp.vehiclePlate || '';
  }
}
