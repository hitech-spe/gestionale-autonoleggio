import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, tap } from 'rxjs';
import {Customer, RentalService, Vehicle} from '../../../../services/rental.service';
import { LoadingService } from '../../../../services/loading.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-customers-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers-tab.component.html'
})
export class CustomersTabComponent implements OnInit {
  private rentalService = inject(RentalService);
  private loadingService = inject(LoadingService);

  customers$!: Observable<Customer[]>;
  searchTerm = '';
  sortOrder: 'newest' | 'oldest' | 'alpha' = 'newest';

  isModalOpen = false;
  isEditMode = false;
  editingCustomerId?: string;
  newCustomer: any = {};
  pendingAttachments: { name: string; data: string }[] = [];

  ngOnInit() {
    this.loadingService.show();
    this.customers$ = this.rentalService.getCustomers().pipe(
      tap({
        next: () => this.loadingService.hide(),
        error: (err) => {
          console.error('Error loading customers:', err);
          this.loadingService.hide();
        }
      })
    );
  }

  openModal(customer?: Customer) {
    if (customer) {
      this.isEditMode = true;
      this.editingCustomerId = customer.id;
      // Convertiamo i Timestamp in stringhe YYYY-MM-DD per l'input date
      const birthDate = customer.birthDate && (customer.birthDate as any).toDate ? (customer.birthDate as any).toDate().toISOString().split('T')[0] : '';
      const licenseExpiry = customer.licenseExpiry && (customer.licenseExpiry as any).toDate ? (customer.licenseExpiry as any).toDate().toISOString().split('T')[0] : '';
      const licenseIssueDate = customer.licenseIssueDate && (customer.licenseIssueDate as any).toDate ? (customer.licenseIssueDate as any).toDate().toISOString().split('T')[0] : '';
      
      this.newCustomer = { 
        ...customer,
        birthDate: birthDate,
        licenseExpiry: licenseExpiry,
        licenseIssueDate: licenseIssueDate
      };
      this.pendingAttachments = [...(customer.attachments || [])];
    } else {
      this.isEditMode = false;
      this.editingCustomerId = undefined;
      this.newCustomer = {};
      this.pendingAttachments = [];
    }
    this.isModalOpen = true;
  }

  closeModal() { this.isModalOpen = false; this.newCustomer = {}; this.pendingAttachments = []; }

  async saveCustomer() {
    if (!this.newCustomer.firstName || !this.newCustomer.lastName) return;
    try {
      this.loadingService.show();
      const data: Customer = {
        ...this.newCustomer,
        birthDate: this.newCustomer.birthDate ? Timestamp.fromDate(new Date(this.newCustomer.birthDate)) : null,
        licenseExpiry: this.newCustomer.licenseExpiry ? Timestamp.fromDate(new Date(this.newCustomer.licenseExpiry)) : null,
        licenseIssueDate: this.newCustomer.licenseIssueDate ? Timestamp.fromDate(new Date(this.newCustomer.licenseIssueDate)) : null,
        attachments: this.pendingAttachments
      };

      if (this.isEditMode && this.editingCustomerId) {
        await this.rentalService.updateCustomer(this.editingCustomerId, data);
      } else {
        await this.rentalService.addCustomer(data);
      }
      this.loadingService.hide();
      this.closeModal();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore durante il salvataggio del cliente:', error);
      alert('Si è verificato un errore durante il salvataggio del cliente.');
    }
  }

  onNewFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Dimensione massima di 700 KB per prevenire limiti Firestore (1 MB) su Base64
    const maxSizeBytes = 700 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`Il file "${file.name}" è troppo grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). La dimensione massima consentita per gli allegati è di 700 KB per via dei limiti fisici di Firestore (1 MB per documento, incluso il Base64). Prova a comprimere il PDF prima di caricarlo.`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      this.pendingAttachments = [...this.pendingAttachments, { name: file.name, data: reader.result as string }];
    };
    event.target.value = '';
  }

  removePendingAttachment(index: number) {
    this.pendingAttachments = this.pendingAttachments.filter((_, i) => i !== index);
  }

  async onFileSelected(event: any, customer: Customer) {
    const file = event.target.files[0];
    if (!file || !customer.id) return;

    // Dimensione massima di 700 KB per prevenire limiti Firestore (1 MB) su Base64
    const maxSizeBytes = 700 * 1024;
    if (file.size > maxSizeBytes) {
      alert(`Il file "${file.name}" è troppo grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). La dimensione massima consentita per gli allegati è di 700 KB per via dei limiti fisici di Firestore (1 MB per documento, incluso il Base64). Prova a comprimere il PDF prima di caricarlo.`);
      event.target.value = '';
      return;
    }

    this.loadingService.show();
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result as string;
      const updatedAttachments = [...(customer.attachments || []), { name: file.name, data: base64String }];
      try {
        await this.rentalService.updateCustomer(customer.id!, { attachments: updatedAttachments });
        this.loadingService.hide();
      } catch (error) {
        this.loadingService.hide();
        console.error("Errore durante il salvataggio dell'allegato:", error);
        alert("Si è verificato un errore durante il salvataggio dell'allegato su Firestore. Assicurati che le dimensioni totali del documento del cliente non superino 1 MB.");
      }
    };
  }

  async removeAttachment(customer: Customer, index: number) {
    if (!customer.id || !customer.attachments) return;
    try {
      this.loadingService.show();
      const updatedAttachments = customer.attachments.filter((_, i) => i !== index);
      await this.rentalService.updateCustomer(customer.id, { attachments: updatedAttachments });
      this.loadingService.hide();
    } catch (error) {
      this.loadingService.hide();
      console.error("Errore durante la rimozione dell'allegato:", error);
      alert("Si è verificato un errore durante la rimozione dell'allegato.");
    }
  }

  downloadAttachment(attachment: { name: string; data: string }) {
    const link = document.createElement('a');
    link.href = attachment.data;
    link.download = attachment.name;
    link.click();
  }

  async deleteCustomer(id: string) {
    if (confirm('Sei sicuro di voler eliminare questo cliente?')) {
      try {
        this.loadingService.show();
        await this.rentalService.deleteCustomer(id);
        this.loadingService.hide();
      } catch (error) {
        this.loadingService.hide();
        console.error('Errore durante l\'eliminazione del cliente:', error);
        alert('Si è verificato un errore durante l\'eliminazione del cliente.');
      }
    }
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString('it-IT');
    return new Date(timestamp).toLocaleDateString('it-IT');
  }

  getFiltered(items: Customer[] | null): Customer[] {
    if (!items) return [];
    let filtered = items
        .filter(i => {
          const first = i.firstName?.toLowerCase() || '';
          const last = i.lastName?.toLowerCase() || '';
          const term = this.searchTerm.toLowerCase();
          return first.includes(term) || last.includes(term);
        });

    return filtered.sort((a, b) => {
      if (this.sortOrder === 'newest') {
        const dateA = (a.createdAt as any)?.seconds || 0;
        const dateB = (b.createdAt as any)?.seconds || 0;
        return dateB - dateA;
      } else if (this.sortOrder === 'oldest') {
        const dateA = (a.createdAt as any)?.seconds || 0;
        const dateB = (b.createdAt as any)?.seconds || 0;
        return dateA - dateB;
      } else {
        return a.lastName.localeCompare(b.lastName);
      }
    });
  }
}
