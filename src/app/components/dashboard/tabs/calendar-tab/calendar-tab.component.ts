import { Component, Input, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, combineLatest, map, switchMap, BehaviorSubject, tap } from 'rxjs';
import { Rental, RentalService, Vehicle, Customer, TemporaryTransfer, MaintenancePeriod, Maintenance, ContractDocument, ContractDetails, Company } from "../../../../services/rental.service";
import { LoadingService } from '../../../../services/loading.service';
import { Timestamp } from '@angular/fire/firestore';
import { VehicleSelectComponent } from "../../../../shared/vehicle-select/vehicle-select.component";
import { CustomerSelectComponent } from "../../../../shared/customer-select/customer-select.component";

@Component({
  selector: 'app-calendar-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, VehicleSelectComponent, CustomerSelectComponent],
  templateUrl: './calendar-tab.component.html',
  styleUrls: ['./calendar-tab.component.scss']
})
export class CalendarTabComponent implements OnInit {
  @Input() selectedLocation$!: Observable<string>;
  
  private rentalService = inject(RentalService);
  private loadingService = inject(LoadingService);
  
  vehiclesData$!: Observable<{
    vehicle: Vehicle, 
    rentals: Rental[], 
    transfers: TemporaryTransfer[], 
    maintenances: MaintenancePeriod[],
    displayLocation: string
  }[]>;
  days: { date: Date, dateStr: string, isToday: boolean }[] = [];
  
  // Filtri e Ricerca
  searchTerm: string = '';
  sortBy: 'category' | 'brand' | 'plate' = 'category';
  
  // Navigazione Calendario
  startDate: Date = new Date();
  monthOptions: { label: string, value: string }[] = [];
  displayedVehicleIds: string[] = [];
  currentVehiclesData: any[] = [];
  selectedVehicleId: string | null = null;
  selectedDay: Date | null = null;
  selectedCellKey: string | null = null;
  allMaintenances: Maintenance[] = [];
  newInlineJob: any = { description: '', cost: null, km: null };
  
  // Modali e stati
  selectedRental: Rental | null = null;
  isRentalModalOpen = false;
  isMaintenanceModalOpen = false;
  isTransferModalOpen = false;
  isConfirmationModalOpen = false;
  isSaleModalOpen = false;
  selectedStatusForAction: any = null;
  selectedDayForAction: Date | null = null;
  manualEndDate: string = '';
  isEditMode = false;
  editingRentalId?: string;

  // Form data
  newRental: any = { location: 'Mottola', returnLocation: 'Mottola', status: 'Prenotato', isServiceRental: false };
  newMaintenance: any = { vehicleId: '', startDate: '', endDate: '', notes: '' };
  newTransfer: any = { vehicleId: '', startDate: '', endDate: '', location: 'Mottola', notes: '' };
  newSale: any = { vehicleId: '', soldDate: '' };

  isQuickCustomer = false;
  quickCustomer: any = { firstName: '', lastName: '', phone: '', address: '' };

  // Contract fields
  isContractModalOpen = false;
  isGeneratingContract = false;
  contractDetails: ContractDetails = {};
  contractRental?: Rental;
  contractVehicle?: Vehicle;
  contractCustomer?: Customer;

  availableVehicles: Vehicle[] = [];
  availableCustomers: Customer[] = [];
  availableCompanies: Company[] = [];

  companySearchTerm = '';
  isCompanyDropdownOpen = false;

  readonly CATEGORY_ORDER = [
    'A', 'B', 'C', 'D', 'E', 'F', '7 posti', 'Van 9 posti', 
    'L1H1', 'L2H1', 'L2H2', 'L3H3', 'L4H3', 'Cassa quadrata',
    'Cassone aperto 3 posti', 'Cassone aperto 7 posti', 
    'Sponda idraulica', 'Refrigerato', 'Ribaltabile', 'ILVA'
  ];

  private searchSubject = new BehaviorSubject<string>('');
  private sortSubject = new BehaviorSubject<'category' | 'brand' | 'plate'>('category');
  private dateSubject = new BehaviorSubject<Date>(new Date());

  ngOnInit() {
    this.generateMonthOptions();
    this.startDate = new Date();
    this.startDate.setDate(this.startDate.getDate() - 3);
    this.dateSubject.next(this.startDate);

    this.dateSubject.subscribe(date => {
      this.generateDays(date);
    });
    
    this.rentalService.getVehicles().subscribe(v => this.availableVehicles = v);
    this.rentalService.getCustomers().subscribe(c => this.availableCustomers = c);
    this.rentalService.getCompanies().subscribe(companies => this.availableCompanies = companies);
    this.rentalService.getMaintenances().subscribe(m => this.allMaintenances = m);

    this.loadingService.show();
    this.vehiclesData$ = combineLatest([
      this.selectedLocation$,
      this.searchSubject,
      this.sortSubject
    ]).pipe(
      switchMap(([loc, search, sort]) => {
        const filterLoc = loc === 'Tutte' ? undefined : loc;
        return combineLatest([
          this.rentalService.getVehicles(filterLoc),
          this.rentalService.getRentals(filterLoc),
          this.rentalService.getTemporaryTransfers(),
          this.rentalService.getMaintenancePeriods()
        ]).pipe(
          map(([vehicles, rentals, transfers, maintenances]) => {
            // Filtraggio
            let filteredVehicles = vehicles.filter(v => {
              const s = search.toLowerCase();
              const brand = v.brand?.toLowerCase() || '';
              const model = v.model?.toLowerCase() || '';
              const plate = v.plate?.toLowerCase() || '';
              const category = v.category?.toLowerCase() || '';

              return brand.includes(s) || 
                     model.includes(s) || 
                     plate.includes(s) ||
                     category.includes(s);
            });

            // Ordinamento
            filteredVehicles.sort((a, b) => {
              if (sort === 'category') {
                const indexA = this.CATEGORY_ORDER.indexOf(a.category);
                const indexB = this.CATEGORY_ORDER.indexOf(b.category);
                if (indexA === -1 && indexB === -1) return a.category.localeCompare(b.category);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
              } else if (sort === 'brand') {
                return a.brand.localeCompare(b.brand);
              } else {
                return a.plate.localeCompare(b.plate);
              }
            });

            return filteredVehicles.map(v => {
              const vehicleRentals = rentals.filter(r => r.vehicleId === v.id);
              const vehicleTransfers = transfers.filter(t => t.vehicleId === v.id);
              const vehicleMaintenances = maintenances.filter(m => m.vehicleId === v.id);

              return {
                vehicle: v,
                rentals: vehicleRentals,
                transfers: vehicleTransfers,
                maintenances: vehicleMaintenances,
                displayLocation: v.location
              };
            });
          })
        );
      }),
      map(data => {
        this.displayedVehicleIds = data.map(item => item.vehicle.id).filter((id): id is string => !!id);
        this.currentVehiclesData = data;
        return data;
      }),
      tap({
        next: () => this.loadingService.hide(),
        error: (err) => {
          console.error('Error loading calendar data:', err);
          this.loadingService.hide();
        }
      })
    );
  }

  // --- LOGICA FILTRI E NAVIGAZIONE ---

  onSearchChange() {
    this.searchSubject.next(this.searchTerm);
  }

  onSortChange() {
    this.sortSubject.next(this.sortBy);
  }

  clearSearch() {
    this.searchTerm = '';
    this.onSearchChange();
  }

  prevPeriod() {
    const newDate = new Date(this.startDate);
    newDate.setDate(newDate.getDate() - 7);
    this.startDate = newDate;
    this.dateSubject.next(this.startDate);
  }

  nextPeriod() {
    const newDate = new Date(this.startDate);
    newDate.setDate(newDate.getDate() + 7);
    this.startDate = newDate;
    this.dateSubject.next(this.startDate);
  }

  prevMonth() {
    const newDate = new Date(this.startDate);
    newDate.setMonth(newDate.getMonth() - 1);
    this.startDate = newDate;
    this.dateSubject.next(this.startDate);
  }

  nextMonth() {
    const newDate = new Date(this.startDate);
    newDate.setMonth(newDate.getMonth() + 1);
    this.startDate = newDate;
    this.dateSubject.next(this.startDate);
  }

  goToToday() {
    const today = new Date();
    today.setDate(today.getDate() - 3);
    this.startDate = today;
    this.dateSubject.next(this.startDate);
  }

  generateMonthOptions() {
    const options = [];
    const base = new Date();
    // Genera 6 mesi passati e 18 mesi futuri per la selezione rapida
    const start = new Date(base.getFullYear(), base.getMonth() - 6, 1);
    for (let i = 0; i < 24; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      options.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value: d.toISOString().split('T')[0]
      });
    }
    this.monthOptions = options;
  }

  onMonthSelect(event: any) {
    const val = event.target.value;
    if (val) {
      this.startDate = new Date(val);
      this.dateSubject.next(this.startDate);
    }
  }

  getSelectedMonthValue(): string {
    if (!this.startDate) return '';
    const y = this.startDate.getFullYear();
    const m = String(this.startDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  getFormattedStartDate(): string {
    if (!this.startDate) return '';
    const y = this.startDate.getFullYear();
    const m = String(this.startDate.getMonth() + 1).padStart(2, '0');
    const d = String(this.startDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onDateJump(value: any) {
    const dateStr = value?.target?.value || value;
    if (dateStr) {
      this.startDate = new Date(dateStr);
      this.dateSubject.next(this.startDate);
    }
  }

  isSameDay(d1: any, d2: any): boolean {
    if (!d1 || !d2) return false;
    try {
      const date1 = d1 instanceof Date ? d1 : new Date(d1);
      const date2 = d2 instanceof Date ? d2 : new Date(d2);
      if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
      return date1.getDate() === date2.getDate() &&
             date1.getMonth() === date2.getMonth() &&
             date1.getFullYear() === date2.getFullYear();
    } catch {
      return false;
    }
  }

  scrollSelectedIntoView() {
    setTimeout(() => {
      const selectedRow = document.querySelector('.is-selected-row');
      if (selectedRow) {
        selectedRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  }

  triggerActionOnSelectedCell() {
    if (!this.selectedVehicleId || !this.selectedDay) return;
    const rowItem = this.currentVehiclesData.find(item => item.vehicle.id === this.selectedVehicleId);
    if (rowItem) {
      const status = this.getDayStatus(rowItem, this.selectedDay);
      if (status && status.type) {
        this.selectedStatusForAction = status;
        this.selectedDayForAction = this.selectedDay;
        this.manualEndDate = this.selectedDay.toISOString().split('T')[0];
        this.isConfirmationModalOpen = true;
      } else {
        this.openRentalModal();
      }
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    // Evita di attivare scorciatoie se l'utente sta scrivendo in un input o form
    const activeElem = document.activeElement;
    if (activeElem) {
      const tagName = activeElem.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea' || activeElem.getAttribute('contenteditable') === 'true') {
        if (event.key === 'Escape') {
          this.closeModals();
          if (tagName === 'input' && (activeElem as HTMLInputElement).placeholder?.includes('Cerca')) {
            this.clearSearch();
            (activeElem as HTMLInputElement).blur();
          }
        }
        return;
      }
    }

    const hasSelection = this.selectedVehicleId !== null && this.selectedDay !== null;

    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        event.preventDefault();
        if (hasSelection) {
          const currentIndex = this.days.findIndex(d => this.isSameDay(d.date, this.selectedDay));
          if (currentIndex > 0) {
            this.selectCell(this.getSelectedVehicleData(), this.days[currentIndex - 1].date);
          } else {
            this.prevPeriod();
            setTimeout(() => {
              this.selectCell(this.getSelectedVehicleData(), this.days[0].date);
            }, 50);
          }
        } else {
          this.prevPeriod();
        }
        break;

      case 'ArrowRight':
      case 'd':
      case 'D':
        event.preventDefault();
        if (hasSelection) {
          const currentIndex = this.days.findIndex(d => this.isSameDay(d.date, this.selectedDay));
          if (currentIndex < this.days.length - 1) {
            this.selectCell(this.getSelectedVehicleData(), this.days[currentIndex + 1].date);
          } else {
            this.nextPeriod();
            setTimeout(() => {
              this.selectCell(this.getSelectedVehicleData(), this.days[this.days.length - 1].date);
            }, 50);
          }
        } else {
          this.nextPeriod();
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        if (hasSelection) {
          const currentVehIndex = this.displayedVehicleIds.indexOf(this.selectedVehicleId!);
          if (currentVehIndex > 0) {
            this.selectedVehicleId = this.displayedVehicleIds[currentVehIndex - 1];
            this.scrollSelectedIntoView();
          }
        }
        break;

      case 'ArrowDown':
        event.preventDefault();
        if (hasSelection) {
          const currentVehIndex = this.displayedVehicleIds.indexOf(this.selectedVehicleId!);
          if (currentVehIndex < this.displayedVehicleIds.length - 1) {
            this.selectedVehicleId = this.displayedVehicleIds[currentVehIndex + 1];
            this.scrollSelectedIntoView();
          }
        }
        break;

      case 'w':
      case 'W':
        event.preventDefault();
        if (hasSelection) {
          const currentVehIndex = this.displayedVehicleIds.indexOf(this.selectedVehicleId!);
          if (currentVehIndex > 0) {
            this.selectedVehicleId = this.displayedVehicleIds[currentVehIndex - 1];
            this.scrollSelectedIntoView();
          }
        } else {
          this.prevMonth();
        }
        break;

      case 's':
      case 'S':
        event.preventDefault();
        if (hasSelection) {
          const currentVehIndex = this.displayedVehicleIds.indexOf(this.selectedVehicleId!);
          if (currentVehIndex < this.displayedVehicleIds.length - 1) {
            this.selectedVehicleId = this.displayedVehicleIds[currentVehIndex + 1];
            this.scrollSelectedIntoView();
          }
        } else {
          this.nextMonth();
        }
        break;

      case 'PageUp':
        event.preventDefault();
        this.prevMonth();
        break;

      case 'PageDown':
        event.preventDefault();
        this.nextMonth();
        break;

      case 'h':
      case 'H':
      case 't':
      case 'T':
        event.preventDefault();
        this.goToToday();
        if (hasSelection) {
          const today = new Date();
          const foundToday = this.days.find(d => this.isSameDay(d.date, today));
          if (foundToday) {
            this.selectCell(this.getSelectedVehicleData(), foundToday.date);
          }
        }
        break;

      case 'f':
      case 'F':
        const searchInput = document.querySelector('.search-box input') as HTMLInputElement;
        if (searchInput) {
          event.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        break;

      case 'Enter':
        event.preventDefault();
        if (hasSelection) {
          this.triggerActionOnSelectedCell();
        }
        break;

      case 'n':
      case 'N':
        if (hasSelection) {
          event.preventDefault();
          this.openRentalModal();
        }
        break;

      case 'm':
      case 'M':
        if (hasSelection) {
          event.preventDefault();
          this.openMaintenanceModal();
        }
        break;

      case 'p':
      case 'P':
        if (hasSelection) {
          event.preventDefault();
          this.openTransferModal();
        }
        break;

      case 'Escape':
        event.preventDefault();
        if (hasSelection) {
          this.selectedVehicleId = null;
          this.selectedDay = null;
        } else {
          this.closeModals();
        }
        break;
    }
  }

  // --- LOGICA CALENDARIO ---

  getTodayClass(day: Date): string {
    const today = new Date();
    if (day.getDate() === today.getDate() &&
        day.getMonth() === today.getMonth() &&
        day.getFullYear() === today.getFullYear()) {
      return 'is-today';
    }
    return '';
  }

  selectCell(item: any, day: Date) {
    this.selectedVehicleId = item.vehicle.id;
    this.selectedDay = day;
  }

  getSelectedVehicleData() {
    if (!this.selectedVehicleId) return null;
    return this.currentVehiclesData.find(item => item.vehicle.id === this.selectedVehicleId);
  }

  getSelectedCellAddress(): string {
    if (!this.selectedVehicleId || !this.selectedDay) return '';
    const rowItem = this.getSelectedVehicleData();
    if (!rowItem) return '';
    const dateStr = this.selectedDay.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `${rowItem.vehicle.brand} [${dateStr}]`;
  }

  isCellSelected(item: any, day: any): boolean {
    if (!this.selectedVehicleId || !this.selectedDay || !item?.vehicle?.id || !day?.date) return false;
    return this.selectedVehicleId === item.vehicle.id && this.isSameDay(this.selectedDay, day.date);
  }

  getAssociatedJobs(): Maintenance[] {
    if (!this.selectedStatusForAction || this.selectedStatusForAction.type !== 'maintenance') return [];
    const periodId = this.selectedStatusForAction.data.id;
    return this.allMaintenances.filter(m => m.maintenancePeriodId === periodId);
  }

  getAssociatedJobsTotalCost(): number {
    return this.getAssociatedJobs().reduce((sum, job) => sum + (job.cost || 0), 0);
  }

  async addAssociatedJob() {
    if (!this.selectedStatusForAction || !this.newInlineJob.description) return;
    try {
      this.loadingService.show();
      const periodId = this.selectedStatusForAction.data.id;
      const vehicleId = this.selectedStatusForAction.data.vehicleId;
      const v = this.availableVehicles.find(x => x.id === vehicleId);

      const data: Maintenance = {
        vehicleId: vehicleId,
        vehiclePlate: v ? `${v.brand} ${v.model} (${v.plate})` : '?',
        description: this.newInlineJob.description,
        date: this.selectedStatusForAction.data.startDate,
        cost: this.newInlineJob.cost || 0,
        km: this.newInlineJob.km || null,
        maintenancePeriodId: periodId
      };

      await this.rentalService.addMaintenance(data);
      this.loadingService.hide();
      this.newInlineJob = { description: '', cost: null, km: null };
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante l\'aggiunta del lavoro:', error);
      alert('Si è verificato un errore durante l\'aggiunta del lavoro.');
    }
  }

  async deleteAssociatedJob(jobId: string) {
    if (confirm('Sei sicuro di voler eliminare questo lavoro dalla scheda?')) {
      try {
        this.loadingService.show();
        await this.rentalService.deleteMaintenance(jobId);
        this.loadingService.hide();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore durante l\'eliminazione del lavoro:', error);
        alert('Si è verificato un errore.');
      }
    }
  }

  getCellClass(item: any, day: Date, status: any): string[] {
    const classes: string[] = [];

    // Today class
    if (this.getTodayClass(day) === 'is-today') {
      classes.push('is-today');
    }

    // Selection class
    if (this.selectedVehicleId === item.vehicle.id && this.isSameDay(this.selectedDay, day)) {
      classes.push('is-selected-cell');
    }

    // Status backgrounds
    if (status.type === 'maintenance') {
      classes.push('maintenance-gray-bg');
    } else if (status.type === 'sold') {
      classes.push('sold-red-bg');
    } else if (status.type === 'transfer') {
      const locClass = this.getVehicleLocationClass(item, day);
      if (locClass) {
        classes.push(locClass + '-bg');
      }
    }

    return classes;
  }

  private generateDays(baseDate: Date) {
    const arr = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (let i = 0; i < 35; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateNum = String(d.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${dateNum}`;
      
      const dCopy = new Date(d);
      dCopy.setHours(0,0,0,0);
      const isToday = dCopy.getTime() === today.getTime();
      
      arr.push({
        date: d,
        dateStr: dateStr,
        isToday: isToday
      });
    }
    this.days = arr;
  }

  getDayStatus(item: any, day: Date): { type: 'rental' | 'transfer' | 'maintenance' | 'sold' | null, data?: any } {
    const d = new Date(day);
    d.setHours(0,0,0,0);
    const time = d.getTime();

    if (item.vehicle.status === 'Venduto' && item.vehicle.soldDate) {
      const soldDate = item.vehicle.soldDate.toDate();
      soldDate.setHours(0,0,0,0);
      if (time >= soldDate.getTime()) {
        return { type: 'sold', data: item.vehicle };
      }
    }

    const trans = item.transfers.find((t: any) => {
      const s = t.startDate.toDate(); s.setHours(0,0,0,0);
      const e = t.endDate.toDate(); e.setHours(0,0,0,0);
      return time >= s.getTime() && time <= e.getTime();
    });
    if (trans) return { type: 'transfer', data: trans };

    const rental = item.rentals.find((r: any) => {
      if (r.status === 'Cancellato') return false;
      const s = r.startDate.toDate(); s.setHours(0,0,0,0);
      const e = r.endDate.toDate(); e.setHours(0,0,0,0);
      return time >= s.getTime() && time <= e.getTime();
    });
    if (rental) return { type: 'rental', data: rental };

    const maint = item.maintenances.find((m: any) => {
      const s = m.startDate.toDate(); s.setHours(0,0,0,0);
      const e = m.endDate.toDate(); e.setHours(0,0,0,0);
      return time >= s.getTime() && time <= e.getTime();
    });
    if (maint) return { type: 'maintenance', data: maint };

    return { type: null };
  }

  getVehicleLocationAtDate(item: any, day: Date): string | null {
    const d = new Date(day);
    d.setHours(0,0,0,0);
    const time = d.getTime();

    const trans = item.transfers.find((t: any) => {
      const s = t.startDate.toDate(); s.setHours(0,0,0,0);
      const e = t.endDate.toDate(); e.setHours(0,0,0,0);
      return time >= s.getTime() && time <= e.getTime();
    });

    if (trans) return trans.location;
    return null;
  }
  
  getVehicleLocationClass(item: any, day?: Date): string {
    const location = day ? this.getVehicleLocationAtDate(item, day) : null;
    return location ? this.getLocationClass(location) : this.getLocationClass(item.vehicle.location);
  }

  getCurrentVehicleLocationClass(item: any): string {
    const now = new Date();
    const currentLoc = this.getVehicleLocationAtDate(item, now);
    return this.getLocationClass(currentLoc || item.vehicle.location);
  }
  
  getLocationClass(location: string): string {
    switch(location) {
      case 'Massafra': return 'loc-massafra';
      case 'Mottola': return 'loc-mottola';
      case 'Grottaglie': return 'loc-grottaglie';
      default: return '';
    }
  }

  getRentalBarClass(rental: any, day: Date, allRentals: any[] = []): string {
    const d = new Date(day);
    d.setHours(0,0,0,0);
    const time = d.getTime();

    const start = rental.startDate.toDate(); start.setHours(0,0,0,0);
    const end = rental.endDate.toDate(); end.setHours(0,0,0,0);

    const isStart = time === start.getTime();
    const isEnd = time === end.getTime();

    // Check if another rental starts or ends on this exact day for this vehicle
    const hasOverlapTransition = allRentals && allRentals.some((r: any) => {
      if (r.id === rental.id || r.status === 'Cancellato') return false;
      const s = r.startDate.toDate(); s.setHours(0,0,0,0);
      const e = r.endDate.toDate(); e.setHours(0,0,0,0);
      return (isEnd && s.getTime() === time) || (isStart && e.getTime() === time);
    });

    if (hasOverlapTransition) {
      return 'rental-same-day'; // Orange turnover/transition day!
    }

    if (isStart && isEnd) {
      return 'rental-same-day';
    }
    if (isStart) {
      return 'rental-start-day';
    }
    if (isEnd) {
      return 'rental-end-day';
    }
    if (rental.isServiceRental) {
      return 'service-rental-purple';
    }
    return this.getLocationClass(rental.location);
  }

  getRentalDayLabel(rental: any, day: Date, allRentals: any[] = []): string {
    const d = new Date(day);
    d.setHours(0,0,0,0);
    const time = d.getTime();

    const start = rental.startDate.toDate(); start.setHours(0,0,0,0);
    const end = rental.endDate.toDate(); end.setHours(0,0,0,0);

    const isStart = time === start.getTime();
    const isEnd = time === end.getTime();

    const formatPeriod = (period: string) => {
      if (period === 'Tarda mat') return 'T.mat';
      return period;
    };

    const startP = formatPeriod(rental.startPeriod || 'Mat');
    const endP = formatPeriod(rental.endPeriod || 'Mat');

    // Check if another rental transitions here
    const transitionRental = allRentals && allRentals.find((r: any) => {
      if (r.id === rental.id || r.status === 'Cancellato') return false;
      const s = r.startDate.toDate(); s.setHours(0,0,0,0);
      const e = r.endDate.toDate(); e.setHours(0,0,0,0);
      return (isEnd && s.getTime() === time) || (isStart && e.getTime() === time);
    });

    if (transitionRental) {
      const otherStartP = formatPeriod(transitionRental.startPeriod || 'Mat');
      const otherEndP = formatPeriod(transitionRental.endPeriod || 'Mat');
      
      if (isEnd) {
        return `⇄ ${endP}/${otherStartP}`;
      } else {
        return `⇄ ${otherEndP}/${startP}`;
      }
    }

    if (isStart && isEnd) {
      if (startP === endP) return startP;
      return `${startP}-${endP}`;
    }
    if (isStart) {
      return startP;
    }
    if (isEnd) {
      return endP;
    }
    return '';
  }

  // --- AZIONI MODALI ---

  openRentalModal(rental?: Rental) {
    this.isQuickCustomer = false;
    this.quickCustomer = { firstName: '', lastName: '', phone: '', address: '' };
    if (rental) {
      this.isEditMode = true;
      this.editingRentalId = rental.id;
      const startDate = rental.startDate && (rental.startDate as any).toDate ? (rental.startDate as any).toDate().toISOString().split('T')[0] : '';
      const endDate = rental.endDate && (rental.endDate as any).toDate ? (rental.endDate as any).toDate().toISOString().split('T')[0] : '';
      this.newRental = { 
        ...rental, 
        startDate, 
        endDate, 
        isServiceRental: !!rental.isServiceRental,
        startPeriod: rental.startPeriod || 'Mat',
        endPeriod: rental.endPeriod || 'Mat'
      };
    } else {
      this.isEditMode = false;
      this.editingRentalId = undefined;
      const dateStr = this.selectedDay ? this.selectedDay.toISOString().split('T')[0] : '';
      this.newRental = { 
        vehicleId: this.selectedVehicleId || '',
        customerId: '',
        location: 'Mottola', 
        returnLocation: 'Mottola', 
        status: 'Prenotato', 
        isServiceRental: false,
        startDate: dateStr,
        endDate: dateStr,
        startPeriod: 'Mat',
        endPeriod: 'Mat'
      };
    }
    this.isRentalModalOpen = true;
  }

  openMaintenanceModal(vehicleId?: string) {
    const defaultVeh = vehicleId || this.selectedVehicleId || '';
    const dateStr = this.selectedDay ? this.selectedDay.toISOString().split('T')[0] : '';
    this.newMaintenance = { 
      vehicleId: defaultVeh, 
      startDate: dateStr, 
      endDate: dateStr, 
      notes: '' 
    };
    this.isMaintenanceModalOpen = true;
  }

  openTransferModal(vehicleId?: string) {
    const defaultVeh = vehicleId || this.selectedVehicleId || '';
    const dateStr = this.selectedDay ? this.selectedDay.toISOString().split('T')[0] : '';
    this.newTransfer = { 
      vehicleId: defaultVeh, 
      startDate: dateStr, 
      endDate: dateStr, 
      location: 'Mottola', 
      notes: '' 
    };
    this.isTransferModalOpen = true;
  }

  openSaleModal() {
    this.newSale = { 
      vehicleId: this.selectedVehicleId || '', 
      soldDate: this.selectedDay ? this.selectedDay.toISOString().split('T')[0] : new Date().toISOString().split('T')[0] 
    };
    this.isSaleModalOpen = true;
  }

  closeModals() {
    this.isRentalModalOpen = false;
    this.isMaintenanceModalOpen = false;
    this.isTransferModalOpen = false;
    this.isConfirmationModalOpen = false;
    this.isSaleModalOpen = false;
    this.selectedRental = null;
    this.selectedStatusForAction = null;
    this.selectedDayForAction = null;
    this.isQuickCustomer = false;
    this.quickCustomer = { firstName: '', lastName: '', phone: '', address: '' };
  }

  // --- SALVATAGGIO DATI ---

  async saveRentalSilent(): Promise<Rental | null> {
    if (!this.newRental.vehicleId || !this.newRental.startDate) return null;
    if (!this.isQuickCustomer && !this.newRental.customerId) return null;
    if (this.isQuickCustomer && (!this.quickCustomer.firstName || !this.quickCustomer.lastName)) {
      alert('Inserisci Nome e Cognome per il nuovo cliente.');
      return null;
    }

    try {
      let customerId = this.newRental.customerId;
      let customerName = '';

      if (this.isQuickCustomer) {
        // Creazione rapida del cliente
        const customerRef = await this.rentalService.addCustomer({
          firstName: this.quickCustomer.firstName,
          lastName: this.quickCustomer.lastName,
          phone: this.quickCustomer.phone || '',
          address: this.quickCustomer.address || ''
        });
        customerId = customerRef.id;
        customerName = `${this.quickCustomer.firstName} ${this.quickCustomer.lastName}`;
      } else {
        const selectedCustomer = this.availableCustomers.find(c => c.id === customerId);
        customerName = selectedCustomer ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : (this.newRental.customerName || 'Cliente non trovato');
      }

      const selectedCar = this.availableVehicles.find(v => v.id === this.newRental.vehicleId);

      const rentalToSave: Rental = {
        ...this.newRental,
        customerId: customerId,
        isServiceRental: !!this.newRental.isServiceRental,
        startPeriod: this.newRental.startPeriod || 'Mat',
        endPeriod: this.newRental.endPeriod || 'Mat',
        customerName: customerName,
        vehiclePlate: selectedCar ? `${selectedCar.brand} ${selectedCar.model} (${selectedCar.plate})` : (this.newRental.vehiclePlate || 'Veicolo non trovato'),
        startDate: Timestamp.fromDate(new Date(this.newRental.startDate)),
        endDate: this.newRental.endDate ? Timestamp.fromDate(new Date(this.newRental.endDate)) : Timestamp.now()
      };

      rentalToSave.status = this.rentalService.calculateStatus(rentalToSave);

      let savedRental: Rental;
      if (this.isEditMode && this.editingRentalId) {
        await this.rentalService.updateRental(this.editingRentalId, rentalToSave);
        savedRental = { ...rentalToSave, id: this.editingRentalId };
      } else {
        const docRef = await this.rentalService.createRental(rentalToSave);
        savedRental = { ...rentalToSave, id: docRef.id };
      }
      return savedRental;
    } catch (error) {
      console.error('Errore noleggio:', error);
      alert('Si è verificato un errore durante il salvataggio del noleggio.');
      return null;
    }
  }

  async saveRental() {
    try {
      this.loadingService.show();
      const saved = await this.saveRentalSilent();
      this.loadingService.hide();
      if (saved) {
        this.closeModals();
      }
    } catch (error) {
      this.loadingService.hide();
    }
  }

  async saveAndStipulateContract() {
    try {
      this.loadingService.show();
      const saved = await this.saveRentalSilent();
      this.loadingService.hide();
      if (saved) {
        this.isRentalModalOpen = false;
        this.openContractModal(saved);
      }
    } catch (error) {
      this.loadingService.hide();
    }
  }

  async saveSale() {
    if (!this.newSale.vehicleId || !this.newSale.soldDate) return;
    try {
      this.loadingService.show();
      const soldDateTimestamp = Timestamp.fromDate(new Date(this.newSale.soldDate));
      await this.rentalService.updateVehicle(this.newSale.vehicleId, {
        status: 'Venduto',
        soldDate: soldDateTimestamp
      });
      this.loadingService.hide();
      this.closeModals();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore registrazione vendita:', error);
      alert('Si è verificato un errore durante la registrazione della vendita.');
    }
  }

  async cancelSale() {
    if (!this.selectedStatusForAction || this.selectedStatusForAction.type !== 'sold') return;
    const vehicle = this.selectedStatusForAction.data;
    
    if (confirm(`Sei sicuro di voler annullare la vendita del veicolo ${vehicle.brand} ${vehicle.model} (${vehicle.plate})?`)) {
      try {
        this.loadingService.show();
        await this.rentalService.updateVehicle(vehicle.id, {
          status: 'Attivo',
          soldDate: null as any
        });
        this.loadingService.hide();
        this.closeModals();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore annullamento vendita:', error);
        alert('Si è verificato un errore durante l\'annullamento della vendita.');
      }
    }
  }

  async saveMaintenance() {
    if (!this.newMaintenance.vehicleId || !this.newMaintenance.startDate || !this.newMaintenance.endDate) return;
    try {
      this.loadingService.show();
      await this.rentalService.addMaintenancePeriod({
        vehicleId: this.newMaintenance.vehicleId,
        startDate: Timestamp.fromDate(new Date(this.newMaintenance.startDate)),
        endDate: Timestamp.fromDate(new Date(this.newMaintenance.endDate)),
        notes: this.newMaintenance.notes
      });
      this.loadingService.hide();
      this.closeModals();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore manutenzione:', error);
    }
  }

  async saveTransfer() {
    if (!this.newTransfer.vehicleId || !this.newTransfer.startDate || !this.newTransfer.endDate) return;
    try {
      this.loadingService.show();
      await this.rentalService.addTemporaryTransfer({
        vehicleId: this.newTransfer.vehicleId,
        startDate: Timestamp.fromDate(new Date(this.newTransfer.startDate)),
        endDate: Timestamp.fromDate(new Date(this.newTransfer.endDate)),
        location: this.newTransfer.location,
        notes: this.newTransfer.notes
      });
      this.loadingService.hide();
      this.closeModals();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore trasferimento:', error);
    }
  }

  getFormattedTooltip(type: string, data: any): string {
    if (type === 'sold') {
      const dateStr = data.soldDate ? (data.soldDate as any).toDate().toLocaleDateString('it-IT') : '-';
      return `Veicolo Venduto il ${dateStr}\n\nClicca su un giorno per annullare la vendita`;
    }
    if (type === 'rental') {
      const start = data.startDate.toDate().toLocaleDateString('it-IT');
      const end = data.endDate.toDate().toLocaleDateString('it-IT');
      const typeLabel = data.isServiceRental ? 'Noleggio per Servizi' : 'Noleggio Standard';
      return `${typeLabel}: ${data.customerName}\nDal ${start} al ${end}\nSede: ${data.location} -> ${data.returnLocation || data.location}\n\nClicca su un giorno per terminare o allungare il noleggio`;
    }
    if (type === 'maintenance') {
      return `In Manutenzione\nNote: ${data.notes || '-'}\n\nClicca su un giorno per terminare o allungare la manutenzione`;
    }
    if (type === 'transfer') {
      return `Trasferimento Temporaneo: ${data.location}\nNote: ${data.notes || '-'}\n\nClicca su un giorno per terminare o allungare il trasferimento`;
    }
    return '';
  }

  async onCellClick(item: any, day: Date, status: any) {
    this.selectCell(item, day);

    if (status && status.type) {
      this.selectedStatusForAction = status;
      this.selectedDayForAction = day;
      this.manualEndDate = day.toISOString().split('T')[0];
      this.isConfirmationModalOpen = true;
    }
  }

  async confirmTermination() {
    if (!this.selectedStatusForAction || !this.manualEndDate) return;
    
    const status = this.selectedStatusForAction;
    const finalDate = new Date(this.manualEndDate);

    try {
      this.loadingService.show();
      const newEndDate = Timestamp.fromDate(finalDate);
      if (status.type === 'rental') {
        await this.rentalService.updateRental(status.data.id, { endDate: newEndDate });
      } else if (status.type === 'maintenance') {
        await this.rentalService.updateMaintenancePeriod(status.data.id, { endDate: newEndDate });
      } else if (status.type === 'transfer') {
        await this.rentalService.updateTemporaryTransfer(status.data.id, { endDate: newEndDate });
      }
      this.loadingService.hide();
      this.closeModals();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante l\'aggiornamento dello stato:', error);
      alert('Si è verificato un errore durante l\'operazione.');
    }
  }

  async deleteStatus() {
    if (!this.selectedStatusForAction) return;
    
    const status = this.selectedStatusForAction;
    const confirmMsg = `Sei sicuro di voler eliminare definitivamente questo ${status.type === 'rental' ? 'noleggio' : (status.type === 'maintenance' ? 'periodo di manutenzione' : 'trasferimento')}?`;
    
    if (confirm(confirmMsg)) {
      try {
        this.loadingService.show();
        if (status.type === 'rental') {
          await this.rentalService.deleteRental(status.data.id);
        } else if (status.type === 'maintenance') {
          await this.rentalService.deleteMaintenancePeriod(status.data.id);
          const associatedJobs = this.getAssociatedJobs();
          for (const job of associatedJobs) {
            await this.rentalService.deleteMaintenance(job.id!);
          }
        } else if (status.type === 'transfer') {
          await this.rentalService.deleteTemporaryTransfer(status.data.id);
        }
        this.loadingService.hide();
        this.closeModals();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore durante l\'eliminazione dello stato:', error);
        alert('Si è verificato un errore durante l\'eliminazione.');
      }
    }
  }

  async deleteRentalFromModal(rentalId: string | undefined) {
    if (!rentalId) return;

    const confirmMsg = `Sei sicuro di voler eliminare definitivamente questo noleggio?`;
    if (confirm(confirmMsg)) {
      try {
        this.loadingService.show();
        await this.rentalService.deleteRental(rentalId);
        this.loadingService.hide();
        alert('Noleggio eliminato con successo!');
        this.closeModals();
      } catch (error) {
        this.loadingService.hide();
        console.error("Errore durante l'eliminazione del noleggio dalla modale:", error);
        alert("Si è verificato un errore durante l'eliminazione.");
      }
    }
  }

  // --- CONTROLLER CONTRATTI (PDF) ---

  openContractModal(rental: Rental) {
    this.isRentalModalOpen = false; // chiudi modale noleggio standard
    this.contractRental = rental;
    this.contractVehicle = this.availableVehicles.find(v => v.id === rental.vehicleId);
    this.contractCustomer = this.availableCustomers.find(c => c.id === rental.customerId);
    
    this.companySearchTerm = '';
    this.isCompanyDropdownOpen = false;

    this.contractDetails = {
      contractNumber: '...', // will be filled by observable subscription
      kmOut: undefined, // km uscita non valorizzato inizialmente
      kmIncluded: '2999 km totali', // km inclusi default
      timeOut: '', // Prevalorizzato a vuoto
      timeIn: '',  // Prevalorizzato a vuoto
      deposit: undefined, // Deposito cauzionale inizialmente vuoto
      depositType: '',    // Tipologia deposito inizialmente vuoto
      isCompany: false,
      companyName: '',
      companyVat: '',
      companyAddress: '',
      companyPhone: '',
      companyPec: '',
      mainDriverId: rental.customerId,
      driverBirthPlace: '',
      driverBirthDate: '',
      driverLicenseNumber: '',
      driverLicenseIssueDate: '',
      driverLicenseExpiry: '',
      driverLicenseReleasedBy: '',
      driverLicenseCountry: 'Italia',
      additionalDriver1Id: '',
      additionalDriver2Id: '',
      baseRate: 0,
      extraKmPrice: 0,
      advance: 0,
      fuelLevel: '12/12',
      franchise: 1350,
      vehicleFuelType: this.contractVehicle?.fuelType || 'Diesel'
    };

    // Calculate sequential numeric contract number automatically
    this.rentalService.getNextContractNumber().subscribe(nextNum => {
      this.contractDetails.contractNumber = String(nextNum);
    });

    // Populate main driver details initially
    this.onMainDriverChange();

    this.isContractModalOpen = true;
  }

  get filteredCompanies(): Company[] {
    const term = this.companySearchTerm ? this.companySearchTerm.toLowerCase().trim() : '';
    if (!term) return this.availableCompanies;
    return this.availableCompanies.filter(comp =>
      comp.name.toLowerCase().includes(term) ||
      comp.vat.toLowerCase().includes(term)
    );
  }

  selectCompany(comp: Company) {
    this.contractDetails.companyName = comp.name;
    this.contractDetails.companyVat = comp.vat;
    this.contractDetails.companyAddress = comp.address || '';
    this.contractDetails.companyPhone = comp.phone || '';
    this.contractDetails.companyPec = comp.pec || '';
    this.companySearchTerm = comp.name;
    this.isCompanyDropdownOpen = false;
  }

  clearCompanySearch() {
    this.companySearchTerm = '';
    this.contractDetails.companyName = '';
    this.contractDetails.companyVat = '';
    this.contractDetails.companyAddress = '';
    this.contractDetails.companyPhone = '';
    this.contractDetails.companyPec = '';
  }

  onCompanySearchBlur() {
    setTimeout(() => {
      this.isCompanyDropdownOpen = false;
    }, 250);
  }

  onMainDriverChange() {
    const driverId = this.contractDetails.mainDriverId;
    const driver = this.availableCustomers.find(c => c.id === driverId);
    if (driver) {
      this.contractDetails.driverBirthPlace = driver.birthPlace || '';
      this.contractDetails.driverBirthDate = driver.birthDate && (driver.birthDate as any).toDate ? (driver.birthDate as any).toDate().toISOString().split('T')[0] : '';
      this.contractDetails.driverLicenseNumber = driver.licenseNumber || '';
      this.contractDetails.driverLicenseIssueDate = driver.licenseIssueDate && (driver.licenseIssueDate as any).toDate ? (driver.licenseIssueDate as any).toDate().toISOString().split('T')[0] : '';
      this.contractDetails.driverLicenseExpiry = driver.licenseExpiry && (driver.licenseExpiry as any).toDate ? (driver.licenseExpiry as any).toDate().toISOString().split('T')[0] : '';
      this.contractDetails.driverLicenseReleasedBy = driver.licenseReleasedBy || '';
      this.contractDetails.driverLicenseCountry = driver.licenseCountry || 'Italia';
    } else {
      this.contractDetails.driverBirthPlace = '';
      this.contractDetails.driverBirthDate = '';
      this.contractDetails.driverLicenseNumber = '';
      this.contractDetails.driverLicenseIssueDate = '';
      this.contractDetails.driverLicenseExpiry = '';
      this.contractDetails.driverLicenseReleasedBy = '';
      this.contractDetails.driverLicenseCountry = 'Italia';
    }
  }

  onAdditionalDriver1Change() {
    const driverId = this.contractDetails.additionalDriver1Id;
    const driver = this.availableCustomers.find(c => c.id === driverId);
    if (driver) {
      this.contractDetails.additionalDriver1Address = driver.address || '';
      this.contractDetails.additionalDriver1Phone = driver.phone || '';
    } else {
      this.contractDetails.additionalDriver1Address = '';
      this.contractDetails.additionalDriver1Phone = '';
    }
  }

  onAdditionalDriver2Change() {
    const driverId = this.contractDetails.additionalDriver2Id;
    const driver = this.availableCustomers.find(c => c.id === driverId);
    if (driver) {
      this.contractDetails.additionalDriver2Address = driver.address || '';
      this.contractDetails.additionalDriver2Phone = driver.phone || '';
    } else {
      this.contractDetails.additionalDriver2Address = '';
      this.contractDetails.additionalDriver2Phone = '';
    }
  }

  onCompanyCheckboxChange() {
    if (!this.contractDetails.isCompany && this.contractRental) {
      this.contractDetails.mainDriverId = this.contractRental.customerId;
    }
    this.onMainDriverChange();
  }

  closeContractModal() {
    this.isContractModalOpen = false;
    this.contractRental = undefined;
    this.contractVehicle = undefined;
    this.contractCustomer = undefined;
    this.contractDetails = {};
  }

  async generateContract() {
    if (!this.contractRental || !this.contractVehicle || !this.contractCustomer) {
      alert('Dati insufficienti per generare il contratto. Verifica il cliente ed il veicolo.');
      return;
    }

    try {
      this.isGeneratingContract = true;
      this.loadingService.show();

      // Update customer registry in Firestore with entered details
      if (this.contractDetails.mainDriverId) {
        const updateData: Partial<Customer> = {};
        if (this.contractDetails.driverBirthPlace) {
          updateData.birthPlace = this.contractDetails.driverBirthPlace;
        }
        if (this.contractDetails.driverBirthDate) {
          updateData.birthDate = Timestamp.fromDate(new Date(this.contractDetails.driverBirthDate));
        }
        if (this.contractDetails.driverLicenseNumber) {
          updateData.licenseNumber = this.contractDetails.driverLicenseNumber;
        }
        if (this.contractDetails.driverLicenseIssueDate) {
          updateData.licenseIssueDate = Timestamp.fromDate(new Date(this.contractDetails.driverLicenseIssueDate));
        }
        if (this.contractDetails.driverLicenseExpiry) {
          updateData.licenseExpiry = Timestamp.fromDate(new Date(this.contractDetails.driverLicenseExpiry));
        }
        if (this.contractDetails.driverLicenseReleasedBy) {
          updateData.licenseReleasedBy = this.contractDetails.driverLicenseReleasedBy;
        }
        if (this.contractDetails.driverLicenseCountry) {
          updateData.licenseCountry = this.contractDetails.driverLicenseCountry;
        }

        if (Object.keys(updateData).length > 0) {
          try {
            await this.rentalService.updateCustomer(this.contractDetails.mainDriverId, updateData);
            
            // Sync local cached lists/references
            const cachedDriver = this.availableCustomers.find(c => c.id === this.contractDetails.mainDriverId);
            if (cachedDriver) {
              if (updateData.birthPlace) cachedDriver.birthPlace = updateData.birthPlace;
              if (updateData.birthDate) cachedDriver.birthDate = updateData.birthDate;
              if (updateData.licenseNumber) cachedDriver.licenseNumber = updateData.licenseNumber;
              if (updateData.licenseIssueDate) cachedDriver.licenseIssueDate = updateData.licenseIssueDate;
              if (updateData.licenseExpiry) cachedDriver.licenseExpiry = updateData.licenseExpiry;
              if (updateData.licenseReleasedBy) cachedDriver.licenseReleasedBy = updateData.licenseReleasedBy;
              if (updateData.licenseCountry) cachedDriver.licenseCountry = updateData.licenseCountry;
            }
            if (this.contractCustomer && this.contractCustomer.id === this.contractDetails.mainDriverId) {
              if (updateData.birthPlace) this.contractCustomer.birthPlace = updateData.birthPlace;
              if (updateData.birthDate) this.contractCustomer.birthDate = updateData.birthDate;
              if (updateData.licenseNumber) this.contractCustomer.licenseNumber = updateData.licenseNumber;
              if (updateData.licenseIssueDate) this.contractCustomer.licenseIssueDate = updateData.licenseIssueDate;
              if (updateData.licenseExpiry) this.contractCustomer.licenseExpiry = updateData.licenseExpiry;
              if (updateData.licenseReleasedBy) this.contractCustomer.licenseReleasedBy = updateData.licenseReleasedBy;
              if (updateData.licenseCountry) this.contractCustomer.licenseCountry = updateData.licenseCountry;
            }
          } catch (custError) {
            console.error("Errore nell'aggiornamento dell'anagrafica cliente:", custError);
          }
        }
      }

      // Update vehicle registry in Firestore with entered fuel type if it has changed or is new
      if (this.contractVehicle && this.contractVehicle.id && this.contractDetails.vehicleFuelType) {
        if (this.contractVehicle.fuelType !== this.contractDetails.vehicleFuelType) {
          try {
            await this.rentalService.updateVehicle(this.contractVehicle.id, {
              fuelType: this.contractDetails.vehicleFuelType
            });
            
            // Sync local cached lists/references
            const cachedVehicle = this.availableVehicles.find(v => v.id === this.contractVehicle!.id);
            if (cachedVehicle) {
              cachedVehicle.fuelType = this.contractDetails.vehicleFuelType;
            }
            this.contractVehicle.fuelType = this.contractDetails.vehicleFuelType;
          } catch (vehError) {
            console.error("Errore nell'aggiornamento dell'alimentazione veicolo:", vehError);
          }
        }
      }

      // Se l'utente ha inserito i dettagli dell'azienda, la salviamo in anagrafica se non esiste già
      if (this.contractDetails.isCompany && this.contractDetails.companyName && this.contractDetails.companyVat) {
        const nameUpper = this.contractDetails.companyName.trim().toUpperCase();
        const vatTrimmed = this.contractDetails.companyVat.trim().toUpperCase();
        
        const exists = this.availableCompanies.some(comp => 
          comp.name.trim().toUpperCase() === nameUpper || 
          comp.vat.trim().toUpperCase() === vatTrimmed
        );
        
        if (!exists) {
          try {
            const newCompany: Company = {
              name: this.contractDetails.companyName.trim(),
              vat: this.contractDetails.companyVat.trim(),
              address: this.contractDetails.companyAddress?.trim() || '',
              phone: this.contractDetails.companyPhone?.trim() || '',
              pec: this.contractDetails.companyPec?.trim() || ''
            };
            await this.rentalService.addCompany(newCompany);
            console.log('Nuova azienda salvata con successo!');
          } catch (compError) {
            console.error('Errore durante il salvataggio automatico dell\'azienda:', compError);
          }
        }
      }

      // Persist contract metadata in Firestore
      const contractDoc: ContractDocument = {
        contractNumber: this.contractDetails.contractNumber || 'CONTRATTO',
        rentalId: this.contractRental.id || '',
        customerId: this.contractCustomer.id || '',
        customerName: this.contractDetails.isCompany ? (this.contractDetails.companyName || '') : `${this.contractCustomer.firstName} ${this.contractCustomer.lastName}`,
        vehicleId: this.contractVehicle.id || '',
        vehiclePlate: `${this.contractVehicle.brand} ${this.contractVehicle.model} (${this.contractVehicle.plate})`,
        date: Timestamp.now(), // Stipulation timestamp
        details: this.contractDetails
      };
      
      const cargosData = this.rentalService.mapToCargosFormat(
        this.contractRental,
        this.contractVehicle,
        this.contractCustomer,
        this.contractDetails,
        contractDoc.date
      );
      await this.rentalService.createContract(contractDoc, cargosData);

      // Download generated PDF from microservice and open in new tab
      this.rentalService.downloadContractPdf(contractDoc.contractNumber).subscribe({
        next: (pdfBlob: Blob) => {
          const url = window.URL.createObjectURL(pdfBlob);
          window.open(url, '_blank');
          this.loadingService.hide();
          this.closeContractModal();
          alert('Contratto PDF generato, salvato in archivio ed aperto in una nuova scheda browser!');
          this.isGeneratingContract = false;
        },
        error: (error) => {
          console.error('Errore durante il recupero del PDF dal server:', error);
          this.loadingService.hide();
          alert('Contratto salvato in archivio, ma si è verificato un errore durante la generazione/recupero del PDF dal server.');
          this.isGeneratingContract = false;
        }
      });
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante la generazione del contratto:', error);
      alert('Si è verificato un errore durante la generazione del contratto.');
      this.isGeneratingContract = false;
    }
  }
}
