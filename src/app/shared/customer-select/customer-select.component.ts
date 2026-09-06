import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Customer } from '../../services/rental.service';

@Component({
  selector: 'app-customer-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer-select.component.html',
  styleUrls: ['./customer-select.component.scss']
})
export class CustomerSelectComponent implements OnChanges {
  private elementRef = inject(ElementRef);

  @Input() customerId: string | undefined = '';
  @Output() customerIdChange = new EventEmitter<string>();

  @Input() customers: Customer[] = [];
  @Input() placeholder: string = 'Cerca o seleziona un cliente...';

  searchTerm = '';
  isOpen = false;
  private isFocused = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['customerId'] || changes['customers']) {
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
    if (this.customerId && this.customers && this.customers.length > 0) {
      const selected = this.customers.find(c => c.id === this.customerId);
      if (selected) {
        this.searchTerm = `${selected.firstName} ${selected.lastName}`;
      } else {
        this.searchTerm = '';
      }
    } else {
      this.searchTerm = '';
    }
  }

  get sortedCustomers(): Customer[] {
    const search = this.searchTerm.toLowerCase().trim();
    
    const filtered = (this.customers || []).filter(c => {
      if (!search) return true;
      const text = `${c.firstName} ${c.lastName} ${c.phone || ''} ${c.address || ''}`.toLowerCase();
      return text.includes(search);
    });

    return filtered.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  onFocus() {
    this.isFocused = true;
    this.isOpen = true;
    this.searchTerm = '';
  }

  onBlur() {
    this.isFocused = false;
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

  selectCustomer(customer: Customer) {
    if (!customer.id) return;
    this.customerId = customer.id;
    this.customerIdChange.emit(customer.id);
    this.searchTerm = `${customer.firstName} ${customer.lastName}`;
    this.isOpen = false;
  }
}
