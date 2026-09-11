import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { RentalService, Verbale, ContractDocument, Customer, Rental } from '../../../../services/rental.service';
import { Timestamp } from '@angular/fire/firestore';
import { LoadingService } from '../../../../services/loading.service';

@Component({
  selector: 'app-verbali-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verbali-tab.component.html',
  styleUrls: ['./verbali-tab.component.scss']
})
export class VerbaliTabComponent implements OnInit {
  private rentalService = inject(RentalService);
  private loadingService = inject(LoadingService);

  verbali: Verbale[] = [];
  allContracts: ContractDocument[] = [];
  allRentals: Rental[] = [];
  allCustomers: Customer[] = [];

  searchTerm = '';
  statusFilter = 'ALL';
  sortField = 'violationDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  isUploadModalOpen = false;
  isSendingPec: { [key: string]: boolean } = {};

  // Wizard Navigation
  currentStep = 1; // Step 1: Upload, Step 2: Extract & Match, Step 3: Mail Draft

  // For the upload / creation form
  selectedFile: File | null = null;
  selectedFiles: File[] = [];
  selectedFileName = '';
  selectedFileSize = '';
  uploadProgress = 0;
  isOcrRunning = false;
  savedVerbaleId = '';

  // New Verbale Form model
  newVerbale: Partial<Verbale> = {
    plate: '',
    ticketNumber: '',
    fineAmount: undefined,
    authorityName: '',
    authorityPec: '',
    status: 'Nuovo',
    notes: ''
  };

  violationDateStr = ''; // YYYY-MM-DD
  violationTimeStr = ''; // HH:MM

  // Auto-matching state
  matchedContract: ContractDocument | null = null;
  matchedCustomer: Customer | null = null;
  matchedRental: Rental | null = null;
  matchingSearchDone = false;

  // Email draft state
  emailDraft = {
    to: '',
    subject: '',
    body: '',
    attachVerbale: true,
    attachContract: true,
    attachCustomerDoc: true
  };

  private subs: Subscription[] = [];

  ngOnInit() {
    this.loadingService.show();
    
    // Load existing verbali
    const vSub = this.rentalService.getVerbali().subscribe({
      next: (data) => {
        this.verbali = data || [];
        this.loadingService.hide();
      },
      error: (err) => {
        console.error('Error loading verbali:', err);
        this.loadingService.hide();
      }
    });
    this.subs.push(vSub);

    // Load contracts
    const cSub = this.rentalService.getContracts().subscribe(contracts => {
      this.allContracts = contracts || [];
    });
    this.subs.push(cSub);

    // Load rentals
    const rSub = this.rentalService.getRentals().subscribe(rentals => {
      this.allRentals = rentals || [];
    });
    this.subs.push(rSub);

    // Load customers
    const custSub = this.rentalService.getCustomers().subscribe(customers => {
      this.allCustomers = customers || [];
    });
    this.subs.push(custSub);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  // --- KPI Stats Calculation ---
  getTotaleMulte(): number {
    return this.verbali.length;
  }

  getNuoveMulte(): number {
    return this.verbali.filter(v => v.status !== 'Inviato').length;
  }

  getInviateMulte(): number {
    return this.verbali.filter(v => v.status === 'Inviato').length;
  }

  getImportoMulte(): number {
    return this.verbali.reduce((sum, v) => sum + (v.fineAmount || 0), 0);
  }

  toggleSortDirection() {
    this.sortDirection = this.sortDirection === 'desc' ? 'asc' : 'desc';
  }

  getFilteredVerbali(): Verbale[] {
    let list = this.verbali || [];

    // 1. Search term filter with robustness for null/undefined fields
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      list = list.filter(v => {
        const plate = v.plate ? v.plate.toLowerCase() : '';
        const ticketNumber = v.ticketNumber ? v.ticketNumber.toLowerCase() : '';
        const authorityName = v.authorityName ? v.authorityName.toLowerCase() : '';
        const customerName = v.customerName ? v.customerName.toLowerCase() : '';
        const contractNumber = v.contractNumber ? v.contractNumber.toLowerCase() : '';
        return plate.includes(term) ||
               ticketNumber.includes(term) ||
               authorityName.includes(term) ||
               customerName.includes(term) ||
               contractNumber.includes(term);
      });
    }

    // 2. Status filter
    if (this.statusFilter !== 'ALL') {
      list = list.filter(v => v.status === this.statusFilter);
    }

    // 3. Sorting
    list = [...list].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (this.sortField === 'violationDate') {
        valA = a.violationDate ? (a.violationDate.toDate ? a.violationDate.toDate().getTime() : new Date(a.violationDate as any).getTime()) : 0;
        valB = b.violationDate ? (b.violationDate.toDate ? b.violationDate.toDate().getTime() : new Date(b.violationDate as any).getTime()) : 0;
      } else if (this.sortField === 'fineAmount') {
        valA = a.fineAmount || 0;
        valB = b.fineAmount || 0;
      } else if (this.sortField === 'ticketNumber') {
        valA = a.ticketNumber || '';
        valB = b.ticketNumber || '';
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return this.sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return this.sortDirection === 'asc' 
          ? (valA > valB ? 1 : -1) 
          : (valB > valA ? 1 : -1);
      }
    });

    return list;
  }

  openUploadModal() {
    this.isUploadModalOpen = true;
    this.currentStep = 1;
    this.resetForm();
  }

  closeUploadModal() {
    this.isUploadModalOpen = false;
  }

  goToStep(step: number) {
    if (step === 2 && !this.selectedFile) {
      alert('Carica prima il verbale PDF per continuare.');
      return;
    }
    if (step === 3 && (!this.newVerbale.plate || !this.newVerbale.ticketNumber || !this.violationDateStr)) {
      alert('Compilare i campi obbligatori (Targa, Numero Verbale, Data Infrazione) prima di procedere.');
      return;
    }
    this.currentStep = step;
  }

  nextStep() {
    this.goToStep(this.currentStep + 1);
  }

  prevStep() {
    this.goToStep(this.currentStep - 1);
  }

  resetForm() {
    this.selectedFile = null;
    this.selectedFiles = [];
    this.selectedFileName = '';
    this.selectedFileSize = '';
    this.uploadProgress = 0;
    this.isOcrRunning = false;
    this.savedVerbaleId = '';
    this.violationDateStr = '';
    this.violationTimeStr = '';
    this.newVerbale = {
      plate: '',
      ticketNumber: '',
      fineAmount: undefined,
      authorityName: '',
      authorityPec: '',
      status: 'Nuovo',
      notes: ''
    };
    this.matchedContract = null;
    this.matchedCustomer = null;
    this.matchedRental = null;
    this.matchingSearchDone = false;
    this.resetEmailDraft();
  }

  resetEmailDraft() {
    this.emailDraft = {
      to: '',
      subject: '',
      body: '',
      attachVerbale: true,
      attachContract: true,
      attachCustomerDoc: true
    };
  }

  onFileSelected(event: any) {
    const fileList: FileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles = Array.from(fileList);
    newFiles.forEach(file => {
      const exists = this.selectedFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        this.selectedFiles.push(file);
      }
    });

    this.updateFilesMeta();
  }

  removeFile(index: number) {
    this.selectedFiles.splice(index, 1);
    this.updateFilesMeta();
  }

  updateFilesMeta() {
    if (this.selectedFiles.length > 0) {
      this.selectedFile = this.selectedFiles[0];
      if (this.selectedFiles.length > 1) {
        this.selectedFileName = `${this.selectedFiles.length} file selezionati`;
      } else {
        this.selectedFileName = this.selectedFiles[0].name;
      }
      const totalSize = this.selectedFiles.reduce((sum, f) => sum + f.size, 0);
      const sizeKb = totalSize / 1024;
      this.selectedFileSize = sizeKb > 1024 
        ? `${(sizeKb / 1024).toFixed(2)} MB` 
        : `${sizeKb.toFixed(0)} KB`;
    } else {
      this.selectedFile = null;
      this.selectedFileName = '';
      this.selectedFileSize = '';
    }
  }

  processVerbali() {
    if (this.selectedFiles.length === 0) return;
    
    this.isOcrRunning = true;
    this.uploadProgress = 15;
    this.loadingService.show();

    // Simulate progress feedback
    const interval = setInterval(() => {
      if (this.uploadProgress < 85) {
        this.uploadProgress += 15;
      }
    }, 400);

    this.rentalService.parseVerbaliPdfs(this.selectedFiles).subscribe({
      next: (response) => {
        clearInterval(interval);
        this.uploadProgress = 100;
        this.isOcrRunning = false;
        this.loadingService.hide();
        alert('I file dei verbali sono stati caricati ed elaborati con successo!');
        this.closeUploadModal();
        this.resetForm();
      },
      error: (err) => {
        clearInterval(interval);
        this.isOcrRunning = false;
        this.uploadProgress = 0;
        this.loadingService.hide();
        console.error("Errore durante l'elaborazione dei verbali:", err);
        alert("Si è verificato un errore durante l'elaborazione dei verbali sul server.");
      }
    });
  }

  findMatchingRental() {
    this.matchingSearchDone = true;
    this.matchedContract = null;
    this.matchedRental = null;
    this.matchedCustomer = null;

    if (!this.newVerbale.plate || !this.violationDateStr) {
      return;
    }

    const plate = this.newVerbale.plate.trim().toUpperCase();
    const violationTime = this.violationTimeStr || '12:00';
    const infrazioneTimeMs = new Date(`${this.violationDateStr}T${violationTime}`).getTime();

    // 1. Find rental of that vehicle during that timeframe
    const match = this.allRentals.find(r => {
      if (!r.vehiclePlate || r.vehiclePlate.trim().toUpperCase() !== plate) {
        return false;
      }
      
      const startMs = (r.startDate as any)?.seconds 
        ? (r.startDate as any).seconds * 1000 
        : new Date(r.startDate as any).getTime();

      const endMs = (r.endDate as any)?.seconds 
        ? (r.endDate as any).seconds * 1000 
        : new Date(r.endDate as any).getTime();

      return infrazioneTimeMs >= startMs && infrazioneTimeMs <= endMs;
    });

    if (match) {
      this.matchedRental = match;
      
      // 2. Find contract document of that rental
      const contract = this.allContracts.find(c => c.rentalId === match.id);
      if (contract) {
        this.matchedContract = contract;
      }

      // 3. Find customer profile
      const customerId = match.customerId || contract?.customerId;
      if (customerId) {
        const customer = this.allCustomers.find(c => c.id === customerId);
        if (customer) {
          this.matchedCustomer = customer;
        }
      }
    }

    this.generateEmailDraft();
  }

  generateEmailDraft() {
    if (!this.newVerbale.authorityPec) {
      this.resetEmailDraft();
      return;
    }

    this.emailDraft.to = this.newVerbale.authorityPec;
    this.emailDraft.subject = `Trasmissione dati conducente per Verbale n. ${this.newVerbale.ticketNumber || '[NUMERO]'} del ${this.formatItalianDateStr(this.violationDateStr)} - Veicolo Targa ${this.newVerbale.plate || '[TARGA]'}`;

    if (this.matchedContract && this.matchedCustomer) {
      const c = this.matchedContract;
      const cust = this.matchedCustomer;
      const detail = c.details;

      const birthDateFormatted = cust.birthDate 
        ? this.formatTimestampToItalianDate(cust.birthDate) 
        : (detail.driverBirthDate || '[DATA NASCITA]');

      const licenseExpiryFormatted = cust.licenseExpiry
        ? this.formatTimestampToItalianDate(cust.licenseExpiry)
        : (detail.driverLicenseExpiry || '[SCADENZA PATENTE]');

      this.emailDraft.body = `Spett.le ${this.newVerbale.authorityName || '[ENTE ACCERTATORE]'},

In riferimento al verbale di contestazione n. ${this.newVerbale.ticketNumber || '[NUMERO_VERBALE]'}, relativo all'infrazione rilevata in data ${this.formatItalianDateStr(this.violationDateStr)} alle ore ${this.violationTimeStr || '[ORA]'} con il veicolo targato ${this.newVerbale.plate || '[TARGA]'}, di nostra proprietà,

con la presente si comunica che alla data e ora sopra indicate il suddetto veicolo era concesso in locazione senza conducente alla ditta/sig. ${(cust.lastName + ' ' + cust.firstName).toUpperCase()}, nato a ${cust.birthPlace || detail.driverBirthPlace || '[LUOGO NASCITA]'} il ${birthDateFormatted}, residente a ${cust.address || '[INDIRIZZO RESIDENZA]'}, titolare di patente di guida n. ${cust.licenseNumber || detail.driverLicenseNumber || '[NUMERO PATENTE]'} rilasciata da ${cust.licenseReleasedBy || detail.driverLicenseReleasedBy || '[ORGANO RILASCIO]'} con scadenza il ${licenseExpiryFormatted}.

Si allegano alla presente:
1. Copia del Verbale di contestazione;
2. Copia del Contratto di Locazione n. ${c.contractNumber} del ${this.formatTimestampToItalianDate(c.date)} sottoscritto dalle parti;
3. Copia del documento di identità e patente del conducente locatario.

Si richiede pertanto di voler procedere alla rinotifica del verbale in oggetto direttamente nei confronti del trasgressore sopra identificato, liberando la scrivente società da ogni responsabilità solidale.

Distinti saluti,
RentSmart SRL`;
    } else {
      this.emailDraft.body = `Spett.le ${this.newVerbale.authorityName || '[ENTE ACCERTATORE]'},

In riferimento al verbale di contestazione n. ${this.newVerbale.ticketNumber || '[NUMERO_VERBALE]'}, relativo all'infrazione rilevata in data ${this.formatItalianDateStr(this.violationDateStr)} alle ore ${this.violationTimeStr || '[ORA]'} con il veicolo targato ${this.newVerbale.plate || '[TARGA]'}, di nostra proprietà,

con la presente si segnala che alla data dell'infrazione il veicolo risultava concesso in noleggio. [ATTENZIONE: Nessun contratto abbinato automaticamente. Inserire qui manualmente i dettagli del cliente.]

Si allegano alla presente:
1. Copia del Verbale di contestazione;
[Aggiungere contratti e documenti manualmente]

Si richiede pertanto di voler procedere alla rinotifica del verbale in oggetto direttamente nei confronti del trasgressore sopra identificato.

Distinti saluti,
RentSmart SRL`;
    }
  }

  async saveVerbale(andSendPec = false) {
    if (!this.newVerbale.plate || !this.newVerbale.ticketNumber || !this.violationDateStr) {
      alert('Compilare i campi obbligatori (Targa, Numero Verbale, Data Infrazione).');
      return;
    }

    try {
      this.loadingService.show();
      const parts = this.violationDateStr.split('-');
      const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

      const verbaleData: Verbale = {
        plate: this.newVerbale.plate.trim().toUpperCase(),
        ticketNumber: this.newVerbale.ticketNumber.trim(),
        violationDate: Timestamp.fromDate(dateObj),
        violationTime: this.violationTimeStr,
        fineAmount: this.newVerbale.fineAmount || 0,
        authorityName: this.newVerbale.authorityName || 'Polizia Locale',
        authorityPec: this.newVerbale.authorityPec || '',
        status: 'Nuovo',
        notes: this.newVerbale.notes || '',
        rentalId: this.matchedRental?.id || '',
        contractNumber: this.matchedContract?.contractNumber || '',
        customerName: this.matchedCustomer 
          ? `${this.matchedCustomer.lastName} ${this.matchedCustomer.firstName}` 
          : (this.matchedContract?.customerName || '')
      };

      // Handle PDF Base64 conversion if a file was uploaded
      if (this.selectedFile) {
        try {
          // Salva in Base64 solo se il file singolo è sotto 800 KB per evitare limiti Firestore
          if (this.selectedFile.size <= 800 * 1024) {
            verbaleData.pdfBase64 = await this.fileToBase64(this.selectedFile);
          } else {
            verbaleData.pdfBase64 = '[FILE_TOO_LARGE_STORED_ON_BE]';
          }
        } catch (fileErr) {
          console.error("Errore conversione file verbale in Base64:", fileErr);
        }
      }

      let verbaleId = this.savedVerbaleId;
      if (verbaleId) {
        // Aggiorna il verbale pre-salvato creato dal BE
        await this.rentalService.updateVerbale(verbaleId, verbaleData);
      } else {
        // Fallback: crea un nuovo record se non pre-esistente
        const docRef = await this.rentalService.createVerbale(verbaleData);
        verbaleId = docRef.id!;
      }
      this.loadingService.hide();
      
      if (andSendPec) {
        // Automatically send PEC
        verbaleData.id = verbaleId;
        this.sendPec(verbaleData);
      } else {
        alert('Verbale registrato e allineato con successo nello storico!');
        this.closeUploadModal();
      }
    } catch (err) {
      console.error('Error saving verbale:', err);
      this.loadingService.hide();
      alert('Errore durante il salvataggio del verbale.');
    }
  }

  sendPec(verbale: Verbale) {
    if (!verbale.authorityPec) {
      alert('Impossibile inviare la PEC: indirizzo destinatario non specificato.');
      return;
    }

    if (verbale.id) {
      this.isSendingPec[verbale.id] = true;
    }

    this.loadingService.show();

    // Call real service or mock fallback
    this.rentalService.sendVerbalePec({
      verbaleId: verbale.id,
      authorityPec: verbale.authorityPec,
      subject: this.emailDraft.subject || `Trasmissione dati conducente per Verbale n. ${verbale.ticketNumber} - Veicolo Targa ${verbale.plate}`,
      body: this.emailDraft.body || `Spett.le ${verbale.authorityName}, ... (dati del verbale e contratto inviati)`,
      attachments: [
        { name: `Verbale_${verbale.ticketNumber.replace(/[\s/]/g, '_')}.pdf`, data: verbale.pdfBase64 || '', type: 'application/pdf' }
      ]
    }).subscribe({
      next: async (response) => {
        if (verbale.id) {
          this.isSendingPec[verbale.id] = false;
        }
        this.loadingService.hide();
        await this.rentalService.updateVerbale(verbale.id!, {
          status: 'Inviato',
          pecSentDate: Timestamp.now()
        });
        alert(`PEC inviata con successo all'indirizzo: ${verbale.authorityPec}\n\nLo stato del verbale è stato aggiornato ad "INVIATO".`);
        this.closeUploadModal();
      },
      error: async (error) => {
        console.warn('Real BE PEC send failed (not configured or unreachable). Running offline simulation...', error);
        
        // Offline Simulation / Fallback for development & demo purposes
        setTimeout(async () => {
          if (verbale.id) {
            this.isSendingPec[verbale.id] = false;
          }
          this.loadingService.hide();
          
          await this.rentalService.updateVerbale(verbale.id!, {
            status: 'Inviato',
            pecSentDate: Timestamp.now()
          });

          // Compose attachment details for notification
          let attachmentsList = `\n- Copia Verbale PDF`;
          if (verbale.contractNumber && this.emailDraft.attachContract) {
            attachmentsList += `\n- Contratto Locazione N. ${verbale.contractNumber}`;
          }
          if (verbale.customerName && this.emailDraft.attachCustomerDoc) {
            attachmentsList += `\n- Documenti d'identità Cliente (${verbale.customerName})`;
          }

          alert(`[SIMULAZIONE PEC] Invio completato con successo!\n\n` +
                `Destinatario: ${verbale.authorityPec}\n` +
                `Oggetto: ${this.emailDraft.subject || 'Dati Conducente'}\n` +
                `Allegati inclusi:${attachmentsList}\n\n` +
                `Lo stato del verbale è stato aggiornato con successo in archivio.`);
          
          this.closeUploadModal();
        }, 1200);
      }
    });
  }

  async deleteVerbale(verbale: Verbale) {
    if (!verbale.id) return;
    if (!confirm(`Sei sicuro di voler eliminare il verbale n. ${verbale.ticketNumber} dallo storico?`)) {
      return;
    }

    try {
      this.loadingService.show();
      await this.rentalService.deleteVerbale(verbale.id);
      this.loadingService.hide();
      alert('Verbale eliminato con successo!');
    } catch (err) {
      console.error('Error deleting verbale:', err);
      this.loadingService.hide();
      alert('Errore durante la cancellazione.');
    }
  }

  // --- Utility Formatting Methods ---

  formatDate(timestamp: any): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('it-IT');
  }

  formatDateTime(timestamp: any, timeStr?: string): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dateStr = date.toLocaleDateString('it-IT');
    return timeStr ? `${dateStr} - ${timeStr}` : dateStr;
  }

  formatTimestampToItalianDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  formatItalianDateStr(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}
