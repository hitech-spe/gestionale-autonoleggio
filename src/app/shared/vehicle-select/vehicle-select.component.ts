import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vehicle } from '../../services/rental.service';

interface GroupedVehicles {
  category: string;
  items: Vehicle[];
}

@Component({
  selector: 'app-vehicle-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicle-select.component.html',
  styleUrls: ['./vehicle-select.component.scss']
})
export class VehicleSelectComponent implements OnChanges {
  private elementRef = inject(ElementRef);

  @Input() vehicleId: string | undefined = '';
  @Output() vehicleIdChange = new EventEmitter<string>();

  @Input() vehicles: Vehicle[] = [];
  @Input() excludeSold: boolean = true;
  @Input() placeholder: string = 'Cerca o seleziona un veicolo...';

  searchTerm = '';
  isOpen = false;
  private isFocused = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['vehicleId'] || changes['vehicles']) {
      this.updateSearchTermFromSelected();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      if (this.isOpen) {
        this.isOpen = false;
        this.updateSearchTermFromSelected();
      }
    }
  }

  updateSearchTermFromSelected() {
    if (this.isFocused) return;
    if (this.vehicleId && this.vehicles && this.vehicles.length > 0) {
      const selected = this.vehicles.find(v => v.id === this.vehicleId);
      if (selected) {
        this.searchTerm = `${selected.brand} ${selected.model} (${selected.plate})`;
      } else {
        this.searchTerm = '';
      }
    } else {
      this.searchTerm = '';
    }
  }

  get groupedVehicles(): GroupedVehicles[] {
    const search = this.searchTerm.toLowerCase().trim();
    
    const filtered = (this.vehicles || []).filter(v => {
      if (this.excludeSold && v.status === 'Venduto') return false;
      if (!search) return true;
      const text = `${v.brand} ${v.model} ${v.plate} ${v.category}`.toLowerCase();
      return text.includes(search);
    });

    const groups: { [key: string]: Vehicle[] } = {};
    for (const v of filtered) {
      const cat = v.category || 'Altro';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(v);
    }

    return Object.keys(groups).sort().map(cat => ({
      category: cat,
      items: groups[cat].sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`))
    }));
  }

  onFocus() {
    this.isFocused = true;
    this.isOpen = true;
    // Clear search term on focus so the user can easily see options and type
    this.searchTerm = '';
  }

  onBlur() {
    this.isFocused = false;
    // Small delay to allow mousedown on dropdown item to register first
    setTimeout(() => {
      if (!this.isFocused) {
        this.isOpen = false;
        this.updateSearchTermFromSelected();
      }
    }, 250);
  }

  toggleDropdown(event: Event) {
    event.stopPropagation();
    if (this.isOpen) {
      this.isOpen = false;
      this.updateSearchTermFromSelected();
    } else {
      this.isOpen = true;
      this.searchTerm = '';
      const input = this.elementRef.nativeElement.querySelector('input');
      if (input) {
        input.focus();
      }
    }
  }

  selectVehicle(vehicle: Vehicle) {
    if (!vehicle.id) return;
    this.vehicleId = vehicle.id;
    this.vehicleIdChange.emit(vehicle.id);
    this.searchTerm = `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`;
    this.isOpen = false;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Attivo': return 'bg-success';
      case 'Manutenzione': return 'bg-danger';
      case 'Venduto': return 'bg-dark';
      default: return '';
    }
  }
}
