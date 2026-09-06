import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  addDoc,
  setDoc,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  getDocs,
  writeBatch
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../config/api.config';
import { AuthService } from './auth.service';

// --- INTERFACCE ---
export interface Vehicle {
  id?: string;
  brand: string;
  model: string;
  plate: string;
  location: 'Mottola' | 'Massafra' | 'Grottaglie';
  category: string; // es. 'Segmento A', 'Furgoni', ecc.
  status: 'Attivo' | 'Manutenzione' | 'Venduto';
  dailyPrice?: number;
  fuelType?: string; // es. 'Diesel', 'Benzina', 'Ibrido', 'Elettrico', ecc.
  soldDate?: Timestamp;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface Rental {
  id?: string;
  vehicleId: string;      // Riferimento all'auto
  vehiclePlate?: string;  // Utile da salvare per ricerche veloci
  customerId?: string;    // Riferimento al cliente
  customerName: string;
  customerPhone?: string;
  startDate: Timestamp;   // Usiamo sempre Timestamp di Firebase
  endDate: Timestamp;
  location: 'Mottola' | 'Massafra' | 'Grottaglie';
  returnLocation?: 'Mottola' | 'Massafra' | 'Grottaglie'; // Sede di rientro
  status: 'Prenotato' | 'In Corso' | 'Concluso' | 'Cancellato';
  totalPrice?: number;
  isServiceRental?: boolean;
  startPeriod?: 'Mat' | 'Tarda mat' | 'Pom' | 'Sera';
  endPeriod?: 'Mat' | 'Tarda mat' | 'Pom' | 'Sera';
  notes?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface TemporaryTransfer {
  id?: string;
  vehicleId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  location: 'Mottola' | 'Massafra' | 'Grottaglie';
  notes?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface MaintenancePeriod {
  id?: string;
  vehicleId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  notes?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface Insurance {
  id?: string;
  vehicleId: string;
  vehiclePlate: string;
  company: string;
  policyNumber: string;
  expiryDate: Timestamp;
  notes?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface Inspection {
  id?: string;
  vehicleId: string;
  vehiclePlate: string;
  expiryDate: Timestamp;
  notes?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface Maintenance {
  id?: string;
  vehicleId: string;
  vehiclePlate: string;
  description: string;
  date: Timestamp;
  cost?: number;
  km?: number;
  workshop?: string;
  createdAt?: Timestamp;
  maintenancePeriodId?: string;
  companyId?: string;
}

export interface Customer {
  id?: string;
  firstName: string;
  lastName: string;
  birthDate?: Timestamp;
  birthPlace?: string;
  licenseNumber?: string;
  licenseIssueDate?: Timestamp;
  licenseExpiry?: Timestamp;
  licenseReleasedBy?: string;
  licenseCountry?: string;
  phone?: string;
  address?: string;
  attachments?: { name: string, data: string }[]; // Base64 attachments
  createdAt?: Timestamp;
  companyId?: string;
}

export interface Reminder {
  id?: string;
  text: string;
  date: Timestamp;
  completed?: boolean;
  color?: string; // Hex or CSS color string for the post-it background
  alertBeforeValue?: number; // offset value
  alertBeforeUnit?: 'minutes' | 'hours' | 'days' | 'none'; // offset unit
  repeat?: 'none' | 'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_8_hours' | 'every_12_hours' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  createdAt?: Timestamp;
  companyId?: string;
}

export interface ContractDetails {
  contractNumber?: string;
  kmOut?: number;
  kmIncluded?: string; // e.g. "Senza Limiti", "2000 km totali", etc.
  timeOut?: string;    // e.g. "09:30"
  timeIn?: string;     // e.g. "18:30"
  depositAmount?: number; // Deposito Cauzionale (€)
  depositType?: string;   // Tipologia Deposito (es. Carta, Contanti, ecc.)
  isCompany?: boolean;
  companyName?: string;
  companyVat?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyPec?: string;
  mainDriverId?: string;
  driverBirthPlace?: string;
  driverBirthDate?: string;
  driverLicenseNumber?: string;
  driverLicenseIssueDate?: string;
  driverLicenseExpiry?: string;
  driverLicenseReleasedBy?: string;
  driverLicenseCountry?: string;
  additionalDriver1Id?: string;
  additionalDriver1Address?: string;
  additionalDriver1Phone?: string;
  additionalDriver2Id?: string;
  additionalDriver2Address?: string;
  additionalDriver2Phone?: string;
  baseRate?: number;
  extraKmPrice?: number; // default 0.24
  deposit?: number;      // default 0
  advance?: number;      // default 0
  fuelLevel?: string;    // default "12/12"
  franchise?: number;    // single customizable franchise
  vehicleFuelType?: string; // e.g. "Diesel", "Benzina", etc.
}

export interface ContractDocument {
  id?: string;
  contractNumber: string;
  rentalId: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehiclePlate: string;
  date: Timestamp;
  details: ContractDetails; // Serialized ContractDetails
  createdAt?: Timestamp;
  cargos_status?: 'SENT' | 'FAILED' | string;
  cargos_transaction_id?: string;
  cargos_sync_time?: Timestamp;
  cargos_error?: string | null;
  pdfBase64?: string | null;
  companyId?: string;

  // Flat root fields for Cargos integration
  contratto_data?: string;
  contratto_checkout_data?: string;
  contratto_checkin_data?: string;
  conducente_contraente_nascita_luogo?: string;
  conducente_contraente_nascita_data?: string;
  conducente_contraente_patente_numero?: string;
  conducente_contraente_patente_luogoril?: string;
  conducente_contraente_patente_luogoril_paese?: string;
  conducente_contraente_docide_numero?: string;
  conducente_contraente_docide_luogoril?: string;
  conducente_contraente_docide_luogoril_paese?: string;
}

export interface Company {
  id?: string;
  name: string;
  vat: string;
  address?: string;
  phone?: string;
  pec?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

export interface Verbale {
  id?: string;
  plate: string;
  violationDate: Timestamp;
  violationTime?: string;
  ticketNumber: string;
  fineAmount?: number;
  authorityName: string;
  authorityPec: string;
  status: 'Nuovo' | 'In Corso' | 'Inviato' | 'Errore';
  rentalId?: string;
  contractNumber?: string;
  customerName?: string;
  pecSentDate?: Timestamp;
  pdfBase64?: string | null;
  notes?: string;
  createdAt?: Timestamp;
  companyId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RentalService {
  private firestore = inject(Firestore);
  private http = inject(HttpClient);
  private injector = inject(Injector);
  private authService = inject(AuthService);

  // ==========================================
  // GESTIONE VEICOLI (IL PARCO MEZZI)
  // ==========================================

  /** Recupera tutti i veicoli della Company (con filtro opzionale per sede) */
  getVehicles(location?: string): Observable<Vehicle[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const vehiclesRef = collection(this.firestore, 'vehicles');
    let q = query(vehiclesRef, where('companyId', '==', companyId));

    if (location) {
      q = query(vehiclesRef, where('companyId', '==', companyId), where('location', '==', location));
    }

    return (collectionData(q, { idField: 'id' }) as Observable<Vehicle[]>).pipe(
      map(vehicles => {
        // Ordina per data di inserimento decrescente (più recenti in alto)
        vehicles.sort((a, b) => {
          const dateA = (a.createdAt as any)?.seconds || 0;
          const dateB = (b.createdAt as any)?.seconds || 0;
          if (dateA !== dateB) return dateB - dateA;
          return a.brand.localeCompare(b.brand);
        });
        return vehicles;
      })
    );
  }

  /** Aggiunge una nuova auto */
  async addVehicle(vehicle: Vehicle) {
    const companyId = this.authService.getCurrentCompanyId();
    const vehiclesRef = collection(this.firestore, 'vehicles');
    return addDoc(vehiclesRef, { 
      ...vehicle, 
      companyId, 
      createdAt: Timestamp.now() 
    });
  }

  /** Modifica un'auto */
  async updateVehicle(id: string, data: Partial<Vehicle>) {
    const docRef = doc(this.firestore, `vehicles/${id}`);
    return updateDoc(docRef, data);
  }

  /** Aggiunge un veicolo con dettagli in un batch multi-tenant */
  async addVehicleWithDetails(vehicle: Vehicle, insurance?: Partial<Insurance>, inspection?: Partial<Inspection>, maintenance?: Partial<Maintenance>) {
    const companyId = this.authService.getCurrentCompanyId();
    const batch = writeBatch(this.firestore);
    
    // 1. Aggiungi Veicolo
    const vehicleRef = doc(collection(this.firestore, 'vehicles'));
    batch.set(vehicleRef, { ...vehicle, companyId, createdAt: Timestamp.now() });
    const vehicleId = vehicleRef.id;

    // 2. Assicurazione
    if (insurance && insurance.company && insurance.expiryDate) {
      const insRef = doc(collection(this.firestore, 'insurances'));
      batch.set(insRef, { ...insurance, vehicleId, companyId, vehiclePlate: vehicle.plate });
    }

    // 3. Revisione
    if (inspection && inspection.expiryDate) {
      const inspRef = doc(collection(this.firestore, 'inspections'));
      batch.set(inspRef, { ...inspection, vehicleId, companyId, vehiclePlate: vehicle.plate });
    }

    // 4. Manutenzione
    if (maintenance && maintenance.description && maintenance.date) {
      const maintRef = doc(collection(this.firestore, 'maintenances'));
      batch.set(maintRef, { ...maintenance, vehicleId, companyId, vehiclePlate: vehicle.plate });
    }

    return batch.commit();
  }

  /** Aggiorna un veicolo e i suoi dettagli correlati in un batch */
  async updateVehicleWithDetails(vehicleId: string, vehicle: Partial<Vehicle>, insurance?: Partial<Insurance>, inspection?: Partial<Inspection>, maintenance?: Partial<Maintenance>) {
    const companyId = this.authService.getCurrentCompanyId();
    const batch = writeBatch(this.firestore);
    
    // 1. Aggiorna Veicolo
    const vehicleRef = doc(this.firestore, `vehicles/${vehicleId}`);
    batch.update(vehicleRef, vehicle);
    
    // 2. Assicurazione
    if (insurance && insurance.company && insurance.expiryDate) {
      if (insurance.id) {
        const insRef = doc(this.firestore, `insurances/${insurance.id}`);
        batch.update(insRef, { ...insurance, vehiclePlate: vehicle.plate || (insurance as any).vehiclePlate });
      } else {
        const insRef = doc(collection(this.firestore, 'insurances'));
        batch.set(insRef, { ...insurance, vehicleId, companyId, vehiclePlate: vehicle.plate || (insurance as any).vehiclePlate });
      }
    }

    // 3. Revisione
    if (inspection && inspection.expiryDate) {
      if (inspection.id) {
        const inspRef = doc(this.firestore, `inspections/${inspection.id}`);
        batch.update(inspRef, { ...inspection, vehiclePlate: vehicle.plate || (inspection as any).vehiclePlate });
      } else {
        const inspRef = doc(collection(this.firestore, 'inspections'));
        batch.set(inspRef, { ...inspection, vehicleId, companyId, vehiclePlate: vehicle.plate || (inspection as any).vehiclePlate });
      }
    }

    // 4. Manutenzione
    if (maintenance && maintenance.description && maintenance.date) {
      if (maintenance.id) {
        const maintRef = doc(this.firestore, `maintenances/${maintenance.id}`);
        batch.update(maintRef, { ...maintenance, vehiclePlate: vehicle.plate || (maintenance as any).vehiclePlate });
      } else {
        const maintRef = doc(collection(this.firestore, 'maintenances'));
        batch.set(maintRef, { ...maintenance, vehicleId, companyId, vehiclePlate: vehicle.plate || (maintenance as any).vehiclePlate });
      }
    }

    return batch.commit();
  }

  async getLatestInsurance(vehicleId: string): Promise<Insurance | null> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'insurances');
    const q = query(ref, where('companyId', '==', companyId), where('vehicleId', '==', vehicleId));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Insurance));
    docs.sort((a, b) => {
      const dateA = (a.expiryDate as any)?.seconds || 0;
      const dateB = (b.expiryDate as any)?.seconds || 0;
      return dateB - dateA;
    });
    
    return docs[0];
  }

  async getLatestInspection(vehicleId: string): Promise<Inspection | null> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'inspections');
    const q = query(ref, where('companyId', '==', companyId), where('vehicleId', '==', vehicleId));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Inspection));
    docs.sort((a, b) => {
      const dateA = (a.expiryDate as any)?.seconds || 0;
      const dateB = (b.expiryDate as any)?.seconds || 0;
      return dateB - dateA;
    });

    return docs[0];
  }

  async getLatestMaintenance(vehicleId: string): Promise<Maintenance | null> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'maintenances');
    const q = query(ref, where('companyId', '==', companyId), where('vehicleId', '==', vehicleId));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Maintenance));
    docs.sort((a, b) => {
      const dateA = (a.date as any)?.seconds || 0;
      const dateB = (b.date as any)?.seconds || 0;
      return dateB - dateA;
    });

    return docs[0];
  }

  // ==========================================
  // GESTIONE NOLEGGI
  // ==========================================

  getRentals(location?: string): Observable<Rental[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const rentalsRef = collection(this.firestore, 'rentals');
    let q = query(rentalsRef, where('companyId', '==', companyId));

    if (location) {
      q = query(rentalsRef, where('companyId', '==', companyId), where('location', '==', location));
    }

    return (collectionData(q, { idField: 'id' }) as Observable<Rental[]>).pipe(
      map(rentals => {
        rentals.sort((a, b) => {
          const dateA = (a.startDate as any)?.seconds || 0;
          const dateB = (b.startDate as any)?.seconds || 0;
          return dateB - dateA;
        });

        rentals.forEach(r => {
          const newStatus = this.calculateStatus(r);
          if (r.status !== newStatus) {
            this.updateRental(r.id!, { status: newStatus });
          }
        });
        return rentals;
      })
    );
  }

  /** Registra un nuovo noleggio */
  async createRental(rental: Rental) {
    const companyId = this.authService.getCurrentCompanyId();
    const rentalsRef = collection(this.firestore, 'rentals');
    const docRef = await addDoc(rentalsRef, { 
      ...rental, 
      companyId, 
      createdAt: Timestamp.now() 
    });
    
    if (rental.returnLocation && rental.returnLocation !== rental.location) {
      await this.updateVehicle(rental.vehicleId, { location: rental.returnLocation });
    }
    
    return docRef;
  }

  /** Modifica un noleggio */
  async updateRental(id: string, data: Partial<Rental>) {
    const docRef = doc(this.firestore, `rentals/${id}`);
    await updateDoc(docRef, data);
    
    if (data.returnLocation && data.vehicleId) {
      await this.updateVehicle(data.vehicleId, { location: data.returnLocation });
    }
  }

  // ==========================================
  // GESTIONE TRASFERIMENTI E MANUTENZIONI (CALENDARIO)
  // ==========================================

  getTemporaryTransfers(): Observable<TemporaryTransfer[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'temporary_transfers');
    const q = query(ref, where('companyId', '==', companyId));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<TemporaryTransfer[]>;
    });
  }

  async addTemporaryTransfer(transfer: TemporaryTransfer) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'temporary_transfers');
    return addDoc(ref, { ...transfer, companyId, createdAt: Timestamp.now() });
  }

  async deleteTemporaryTransfer(id: string) {
    const docRef = doc(this.firestore, `temporary_transfers/${id}`);
    return deleteDoc(docRef);
  }

  getMaintenancePeriods(): Observable<MaintenancePeriod[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'maintenance_periods');
    const q = query(ref, where('companyId', '==', companyId));
    return runInInjectionContext(this.injector, () => {
      return collectionData(q, { idField: 'id' }) as Observable<MaintenancePeriod[]>;
    });
  }

  async addMaintenancePeriod(period: MaintenancePeriod) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'maintenance_periods');
    return addDoc(ref, { ...period, companyId, createdAt: Timestamp.now() });
  }

  async deleteMaintenancePeriod(id: string) {
    const docRef = doc(this.firestore, `maintenance_periods/${id}`);
    return deleteDoc(docRef);
  }

  async updateTemporaryTransfer(id: string, data: Partial<TemporaryTransfer>) {
    const docRef = doc(this.firestore, `temporary_transfers/${id}`);
    return updateDoc(docRef, data);
  }

  async updateMaintenancePeriod(id: string, data: Partial<MaintenancePeriod>) {
    const docRef = doc(this.firestore, `maintenance_periods/${id}`);
    return updateDoc(docRef, data);
  }

  calculateStatus(rental: Rental): 'Prenotato' | 'In Corso' | 'Concluso' | 'Cancellato' {
    if (rental.status === 'Cancellato') return 'Cancellato';

    const now = new Date();
    const start = rental.startDate instanceof Timestamp ? rental.startDate.toDate() : new Date(rental.startDate);
    const end = rental.endDate instanceof Timestamp ? rental.endDate.toDate() : new Date(rental.endDate);

    const nowTime = now.getTime();
    const startTime = start.getTime();
    const endTime = end.getTime();

    if (nowTime < startTime) {
      return 'Prenotato';
    } else if (nowTime >= startTime && nowTime <= endTime) {
      return 'In Corso';
    } else {
      return 'Concluso';
    }
  }

  async deleteRental(id: string) {
    const docRef = doc(this.firestore, `rentals/${id}`);
    
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const rental = snap.data() as Rental;
        if (rental.vehicleId && rental.location) {
          await this.updateVehicle(rental.vehicleId, { location: rental.location });
        }
      }
    } catch (e) {
      console.error("Impossibile recuperare i dettagli del noleggio per ripristinare il veicolo:", e);
    }

    try {
      const contractsRef = collection(this.firestore, 'contracts');
      const q = query(contractsRef, where('rentalId', '==', id));
      const contractsSnap = await getDocs(q);
      for (const contractDoc of contractsSnap.docs) {
        await deleteDoc(doc(this.firestore, `contracts/${contractDoc.id}`));
      }
    } catch (e) {
      console.error("Errore durante l'eliminazione dei contratti associati al noleggio:", e);
    }

    return deleteDoc(docRef);
  }

  // ==========================================
  // ASSICURAZIONI, REVISIONI, MANUTENZIONI
  // ==========================================

  getInsurances(): Observable<Insurance[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'insurances');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Insurance[]>).pipe(
      map(ins => {
        ins.sort((a, b) => {
          const dateA = (a.expiryDate as any)?.seconds || 0;
          const dateB = (b.expiryDate as any)?.seconds || 0;
          return dateA - dateB;
        });
        return ins;
      })
    );
  }

  async addInsurance(insurance: Insurance) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'insurances');
    return addDoc(ref, { ...insurance, companyId, createdAt: Timestamp.now() });
  }

  getInspections(): Observable<Inspection[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'inspections');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Inspection[]>).pipe(
      map(insp => {
        insp.sort((a, b) => {
          const dateA = (a.expiryDate as any)?.seconds || 0;
          const dateB = (b.expiryDate as any)?.seconds || 0;
          return dateA - dateB;
        });
        return insp;
      })
    );
  }

  async addInspection(inspection: Inspection) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'inspections');
    return addDoc(ref, { ...inspection, companyId, createdAt: Timestamp.now() });
  }

  getMaintenances(): Observable<Maintenance[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'maintenances');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Maintenance[]>).pipe(
      map(maint => {
        maint.sort((a, b) => {
          const dateA = (a.date as any)?.seconds || 0;
          const dateB = (b.date as any)?.seconds || 0;
          return dateB - dateA;
        });
        return maint;
      })
    );
  }

  async addMaintenance(maintenance: Maintenance) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'maintenances');
    return addDoc(ref, { ...maintenance, companyId, createdAt: Timestamp.now() });
  }

  async updateMaintenance(id: string, data: Partial<Maintenance>) {
    const docRef = doc(this.firestore, `maintenances/${id}`);
    return updateDoc(docRef, data);
  }

  async deleteMaintenance(id: string) {
    const docRef = doc(this.firestore, `maintenances/${id}`);
    return deleteDoc(docRef);
  }

  async updateInsurance(id: string, data: Partial<Insurance>) {
    const docRef = doc(this.firestore, `insurances/${id}`);
    return updateDoc(docRef, data);
  }

  async deleteInsurance(id: string) {
    const docRef = doc(this.firestore, `insurances/${id}`);
    return deleteDoc(docRef);
  }

  async updateInspection(id: string, data: Partial<Inspection>) {
    const docRef = doc(this.firestore, `inspections/${id}`);
    return updateDoc(docRef, data);
  }

  async deleteInspection(id: string) {
    const docRef = doc(this.firestore, `inspections/${id}`);
    return deleteDoc(docRef);
  }

  // ==========================================
  // GESTIONE CLIENTI
  // ==========================================

  getCustomers(): Observable<Customer[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'customers');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Customer[]>).pipe(
      map(custs => {
        custs.sort((a, b) => a.lastName.localeCompare(b.lastName));
        return custs;
      })
    );
  }

  async addCustomer(customer: Customer) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'customers');
    return addDoc(ref, this.cleanUndefined({ ...customer, companyId, createdAt: Timestamp.now() }));
  }

  async updateCustomer(id: string, data: Partial<Customer>) {
    const docRef = doc(this.firestore, `customers/${id}`);
    return updateDoc(docRef, this.cleanUndefined(data));
  }

  async deleteCustomer(id: string) {
    const docRef = doc(this.firestore, `customers/${id}`);
    return deleteDoc(docRef);
  }

  // ==========================================
  // GESTIONE AZIENDE (Sub-units/Branches)
  // ==========================================

  getCompanies(): Observable<Company[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'companies_sub'); // Renamed so it doesn't conflict with main SaaS companies root table
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Company[]>).pipe(
      map(comps => {
        comps.sort((a, b) => a.name.localeCompare(b.name));
        return comps;
      })
    );
  }

  async addCompany(company: Company) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'companies_sub');
    return addDoc(ref, { ...company, companyId, createdAt: Timestamp.now() });
  }

  async updateCompany(id: string, data: Partial<Company>) {
    const docRef = doc(this.firestore, `companies_sub/${id}`);
    return updateDoc(docRef, data);
  }

  async deleteCompany(id: string) {
    const docRef = doc(this.firestore, `companies_sub/${id}`);
    return deleteDoc(docRef);
  }

  // ==========================================
  // ELIMINAZIONE COMPLETA VEICOLO (CASCATA)
  // ==========================================

  async deleteVehicle(id: string) {
    const batch = writeBatch(this.firestore);

    // 1. Veicolo
    const vehicleRef = doc(this.firestore, `vehicles/${id}`);
    batch.delete(vehicleRef);

    // 2. Noleggi
    const rentalsRef = collection(this.firestore, 'rentals');
    const qRentals = query(rentalsRef, where('vehicleId', '==', id));
    const rentalsSnap = await getDocs(qRentals);
    rentalsSnap.forEach(d => batch.delete(d.ref));

    // 3. Assicurazioni
    const insurancesRef = collection(this.firestore, 'insurances');
    const qInsurances = query(insurancesRef, where('vehicleId', '==', id));
    const insurancesSnap = await getDocs(qInsurances);
    insurancesSnap.forEach(d => batch.delete(d.ref));

    // 4. Revisioni
    const inspectionsRef = collection(this.firestore, 'inspections');
    const qInspections = query(inspectionsRef, where('vehicleId', '==', id));
    const inspectionsSnap = await getDocs(qInspections);
    inspectionsSnap.forEach(d => batch.delete(d.ref));

    // 5. Manutenzioni
    const maintenancesRef = collection(this.firestore, 'maintenances');
    const qMaintenances = query(maintenancesRef, where('vehicleId', '==', id));
    const maintenancesSnap = await getDocs(qMaintenances);
    maintenancesSnap.forEach(d => batch.delete(d.ref));

    return batch.commit();
  }

  // ==========================================
  // GESTIONE PROMEMORIA (REMINDERS)
  // ==========================================

  getReminders(): Observable<Reminder[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'reminders');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Reminder[]>).pipe(
      map(rems => {
        rems.sort((a, b) => {
          const dateA = (a.date as any)?.seconds || 0;
          const dateB = (b.date as any)?.seconds || 0;
          return dateA - dateB;
        });
        return rems;
      })
    );
  }

  async addReminder(reminder: Reminder) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'reminders');
    return addDoc(ref, { ...reminder, companyId, createdAt: Timestamp.now() });
  }

  async updateReminder(id: string, data: Partial<Reminder>) {
    const docRef = doc(this.firestore, `reminders/${id}`);
    return updateDoc(docRef, data);
  }

  async toggleReminderCompletion(reminder: Reminder) {
    if (!reminder.id) return;

    const isCurrentlyCompleted = !!reminder.completed;

    if (!isCurrentlyCompleted && reminder.repeat && reminder.repeat !== 'none') {
      const nextDate = this.calculateNextOccurrence(reminder.date.toDate(), reminder.repeat);
      await this.updateReminder(reminder.id, {
        date: Timestamp.fromDate(nextDate),
        completed: false
      });
    } else {
      await this.updateReminder(reminder.id, {
        completed: !isCurrentlyCompleted
      });
    }
  }

  private calculateNextOccurrence(currentDate: Date, repeat: string): Date {
    const next = new Date(currentDate);
    switch (repeat) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        break;
      case 'every_2_hours':
        next.setHours(next.getHours() + 2);
        break;
      case 'every_4_hours':
        next.setHours(next.getHours() + 4);
        break;
      case 'every_8_hours':
        next.setHours(next.getHours() + 8);
        break;
      case 'every_12_hours':
        next.setHours(next.getHours() + 12);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  async deleteReminder(id: string) {
    const docRef = doc(this.firestore, `reminders/${id}`);
    return deleteDoc(docRef);
  }

  // ==========================================
  // GESTIONE CONTRATTI (CONTRACTS HISTORY)
  // ==========================================

  getContracts(): Observable<ContractDocument[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'contracts');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<ContractDocument[]>).pipe(
      map(conts => {
        conts.sort((a, b) => {
          const dateA = (a.date as any)?.seconds || 0;
          const dateB = (b.date as any)?.seconds || 0;
          return dateB - dateA;
        });
        return conts;
      })
    );
  }

  getNextContractNumber(): Observable<number> {
    return this.getContracts().pipe(
      map(contracts => {
        if (!contracts || contracts.length === 0) {
          return 731;
        }
        const nums = contracts
          .map(c => parseInt(c.contractNumber, 10))
          .filter(n => !isNaN(n));
        const max = nums.length > 0 ? Math.max(...nums) : 730;
        return max + 1;
      })
    );
  }

  private cleanUndefined(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Timestamp || obj instanceof Date) {
      return obj;
    }
    const result: any = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = this.cleanUndefined(val);
      }
    }
    return result;
  }

  async createContract(contract: ContractDocument, cargosData?: any) {
    const companyId = this.authService.getCurrentCompanyId();
    const docRef = doc(this.firestore, `contracts/${contract.contractNumber}`);
    const dataToSave = {
      ...contract,
      ...(cargosData || {}),
      companyId,
      createdAt: Timestamp.now()
    };
    return setDoc(docRef, this.cleanUndefined(dataToSave));
  }

  async deleteContract(id: string) {
    const docRef = doc(this.firestore, `contracts/${id}`);
    return deleteDoc(docRef);
  }

  async updateContract(id: string, data: Partial<ContractDocument>) {
    const docRef = doc(this.firestore, `contracts/${id}`);
    return updateDoc(docRef, this.cleanUndefined(data));
  }

  // --- CARGOS INTEGRATION HELPER METHODS ---

  mapToCargosFormat(rental: Rental, vehicle: Vehicle, customer: Customer, details: any, date: Timestamp): any {
    const formatDateTime = (d: any): string => {
      if (!d) return '';
      let dateObj: Date;
      if (d instanceof Date) {
        dateObj = d;
      } else if (d instanceof Timestamp) {
        dateObj = d.toDate();
      } else if (d && typeof d.toDate === 'function') {
        dateObj = d.toDate();
      } else if (d && typeof d.seconds === 'number') {
        dateObj = new Date(d.seconds * 1000);
      } else {
        dateObj = new Date(d);
      }
      if (isNaN(dateObj.getTime())) dateObj = new Date();
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      const hh = String(dateObj.getHours()).padStart(2, '0');
      const min = String(dateObj.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    };

    const formatTimestampWithTime = (t: any, timeStr?: string): string => {
      if (!t) return `20/08/2026 ${timeStr || '12:00'}`;
      let d: Date;
      if (t instanceof Timestamp) {
        d = t.toDate();
      } else if (t && typeof t.toDate === 'function') {
        d = t.toDate();
      } else if (t && typeof t.seconds === 'number') {
        d = new Date(t.seconds * 1000);
      } else {
        d = new Date(t);
      }
      if (isNaN(d.getTime())) d = new Date();
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      let time = timeStr || '12:00';
      
      time = time.replace(/[.,]/g, ':').trim();
      if (time.includes(':')) {
        const parts = time.split(':');
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padEnd(2, '0');
        time = `${hours}:${minutes}`;
      }
      return `${dd}/${mm}/${yyyy} ${time}`;
    };

    const formatBirthDate = (dVal: any): string => {
      if (!dVal) return '15/05/1985';
      let d: Date;
      if (dVal instanceof Timestamp) {
        d = dVal.toDate();
      } else if (dVal.toDate) {
        d = dVal.toDate();
      } else if (dVal && typeof dVal.seconds === 'number') {
        d = new Date(dVal.seconds * 1000);
      } else {
        d = new Date(dVal);
      }
      if (isNaN(d.getTime())) return '15/05/1985';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const branchAddresses: { [key: string]: string } = {
      'Mottola': 'Via S. Allende 1, Mottola (TA)',
      'Massafra': 'Viale Marconi, Massafra (TA)',
      'Grottaglie': 'Via Taranto, Grottaglie (TA)'
    };

    const checkOutAddr = branchAddresses[rental.location] || 'Via S. Allende 1, Mottola (TA)';
    const checkInAddr = branchAddresses[rental.returnLocation || rental.location] || checkOutAddr;

    const categoryLower = (vehicle.category || '').toLowerCase();
    let veicoloTipoDesc = 'autovetture';
    
    if (categoryLower.includes('autocaravan') || categoryLower.includes('camper')) {
      veicoloTipoDesc = 'autocaravan';
    } else if (categoryLower.includes('autobus')) {
      veicoloTipoDesc = 'autobus';
    } else if (
      categoryLower.includes('autocarro') ||
      categoryLower.includes('cassone') ||
      categoryLower.includes('cassa') ||
      categoryLower.includes('sponda') ||
      categoryLower.includes('ribaltabile') ||
      categoryLower.includes('refrigerato') ||
      categoryLower.includes('l3h3') ||
      categoryLower.includes('l4h3')
    ) {
      veicoloTipoDesc = 'autocarri';
    } else if (
      categoryLower.includes('furgon') ||
      categoryLower.includes('van') ||
      categoryLower.includes('l1h1') ||
      categoryLower.includes('l2h1') ||
      categoryLower.includes('l2h2')
    ) {
      veicoloTipoDesc = 'furgoni';
    }

    const veicoloTipo = (veicoloTipoDesc === 'furgoni' || veicoloTipoDesc === 'autocarri') ? '1' : '2';
    const licenseNum = details.driverLicenseNumber || customer.licenseNumber || 'PA987654321';

    const checkoutLuogo = rental.location || 'Mottola';
    const checkinLuogo = rental.returnLocation || rental.location || 'Mottola';
    const nascitaLuogo = customer.birthPlace || details.driverBirthPlace || 'Mottola';
    const rilascioLuogo = details.driverLicenseReleasedBy || customer.licenseReleasedBy || customer.birthPlace || details.driverBirthPlace || rental.location || 'Mottola';

    const patentePaese = details.driverLicenseCountry || customer.licenseCountry || 'Italia';

    return {
      contratto_id: details.contractNumber || '',
      contratto_data: formatDateTime(date),
      contratto_tipop: "0",
      contratto_checkout_data: formatTimestampWithTime(rental.startDate, details.timeOut),
      contratto_checkout_luogo: checkoutLuogo,
      contratto_checkout_indirizzo: checkOutAddr,
      contratto_checkin_data: formatTimestampWithTime(rental.endDate, details.timeIn),
      contratto_checkin_luogo: checkinLuogo,
      contratto_checkin_indirizzo: checkInAddr,
      operatore_id: "OPERATORE SYSTEM",
      agenzia_id: "AG-0001",
      agenzia_nome: "HI-TECH RENT",
      agenzia_luogo: "Mottola",
      agenzia_indirizzo: "Piazza Duomo 1, Milano",
      agenzia_recapito_tel: "02123456",
      veicolo_tipo: veicoloTipo,
      veicolo_tipo_desc: veicoloTipoDesc,
      veicolo_marca: vehicle.brand || 'Fiat',
      veicolo_modello: vehicle.model || 'Panda',
      veicolo_targa: vehicle.plate || 'AB123CD',
      conducente_contraente_cognome: (customer.lastName || 'ROSSI').toUpperCase(),
      conducente_contraente_nome: (customer.firstName || 'MARIO').toUpperCase(),
      conducente_contraente_nascita_data: formatBirthDate(customer.birthDate),
      conducente_contraente_nascita_luogo: nascitaLuogo,
      conducente_contraente_cittadinanza: "Italia",
      conducente_contraente_docide_tipo_cod: "PATENTE DI GUIDA",
      conducente_contraente_docide_numero: licenseNum,
      conducente_contraente_docide_luogoril: rilascioLuogo,
      conducente_contraente_docide_luogoril_paese: patentePaese,
      conducente_contraente_patente_numero: licenseNum,
      conducente_contraente_patente_luogoril: rilascioLuogo,
      conducente_contraente_patente_luogoril_paese: patentePaese,
      conducente_contraente_recapito: customer.phone || '+393331234567'
    };
  }

  checkCargosContract(contractNumber: string): Observable<any> {
    const url = `${API_CONFIG.baseUrl}/api/v1/cargos/contracts/${contractNumber}/check`;
    return this.http.post(url, {});
  }

  sendCargosContract(contractNumber: string): Observable<any> {
    const url = `${API_CONFIG.baseUrl}/api/v1/cargos/contracts/${contractNumber}/send`;
    return this.http.post(url, {});
  }

  sendBulkContracts(contractIds: string[]): Observable<any> {
    const url = `${API_CONFIG.baseUrl}/api/v1/cargos/contracts/send-bulk`;
    return this.http.post(url, contractIds);
  }

  downloadContractPdf(contractNumber: string): Observable<Blob> {
    const url = `${API_CONFIG.baseUrl}/api/v1/contracts/${contractNumber}/pdf`;
    return this.http.get(url, { responseType: 'blob' });
  }

  // ==========================================
  // GESTIONE VERBALI (TRAFFIC VIOLATIONS)
  // ==========================================

  getVerbali(): Observable<Verbale[]> {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'verbali');
    const q = query(ref, where('companyId', '==', companyId));
    return (collectionData(q, { idField: 'id' }) as Observable<Verbale[]>).pipe(
      map(verbs => {
        verbs.sort((a, b) => {
          const dateA = (a.createdAt as any)?.seconds || 0;
          const dateB = (b.createdAt as any)?.seconds || 0;
          return dateB - dateA;
        });
        return verbs;
      })
    );
  }

  async createVerbale(verbale: Verbale) {
    const companyId = this.authService.getCurrentCompanyId();
    const ref = collection(this.firestore, 'verbali');
    return addDoc(ref, { ...verbale, companyId, createdAt: Timestamp.now() });
  }

  async updateVerbale(id: string, updates: Partial<Verbale>) {
    const docRef = doc(this.firestore, `verbali/${id}`);
    return updateDoc(docRef, updates);
  }

  async deleteVerbale(id: string) {
    const docRef = doc(this.firestore, `verbali/${id}`);
    return deleteDoc(docRef);
  }

  parseVerbalePdf(file: File): Observable<any> {
    const url = `${API_CONFIG.baseUrl}/api/v1/verbali/parse`;
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(url, formData);
  }

  parseVerbaliPdfs(files: File[]): Observable<any> {
    const url = `${API_CONFIG.baseUrl}/api/verbali/extract`;
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file, file.name);
    });
    return this.http.post(url, formData);
  }

  sendVerbalePec(payload: {
    verbaleId?: string;
    authorityPec: string;
    subject: string;
    body: string;
    attachments: { name: string; data: string; type: string }[];
  }): Observable<any> {
    const url = `${API_CONFIG.baseUrl}/api/v1/verbali/send-pec`;
    return this.http.post(url, payload);
  }
}
