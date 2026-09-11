import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContractsTabComponent } from './contracts-tab.component';
import { RentalService } from '../../../../services/rental.service';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';

describe('ContractsTabComponent', () => {
  let component: ContractsTabComponent;
  let fixture: ComponentFixture<ContractsTabComponent>;
  let mockRentalService: any;
  let mockFirestore: any;

  beforeEach(async () => {
    mockRentalService = {
      getContracts: jasmine.createSpy('getContracts').and.returnValue(of([])),
      getCustomers: jasmine.createSpy('getCustomers').and.returnValue(of([])),
      getCompanies: jasmine.createSpy('getCompanies').and.returnValue(of([])),
      getRentals: jasmine.createSpy('getRentals').and.returnValue(of([])),
      updateRental: jasmine.createSpy('updateRental').and.returnValue(Promise.resolve()),
      addCompany: jasmine.createSpy('addCompany').and.returnValue(Promise.resolve()),
      deleteContract: jasmine.createSpy('deleteContract').and.returnValue(Promise.resolve()),
      updateContract: jasmine.createSpy('updateContract').and.returnValue(Promise.resolve()),
      sendBulkContracts: jasmine.createSpy('sendBulkContracts').and.returnValue(of([])),
      downloadContractPdf: jasmine.createSpy('downloadContractPdf').and.returnValue(of(new Blob()))
    };

    mockFirestore = {};

    await TestBed.configureTestingModule({
      imports: [ContractsTabComponent],
      providers: [
        { provide: RentalService, useValue: mockRentalService },
        { provide: Firestore, useValue: mockFirestore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ContractsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter contracts correctly', () => {
    const mockContracts = [
      {
        id: '1',
        contractNumber: '70459',
        rentalId: 'r1',
        customerId: 'c1',
        customerName: 'Mario Rossi',
        vehicleId: 'v1',
        vehiclePlate: 'Fiat 500 (FX015NM)',
        date: {} as any,
        details: {}
      },
      {
        id: '2',
        contractNumber: '22345',
        rentalId: 'r2',
        customerId: 'c2',
        customerName: 'RentSmart S.r.l.',
        vehicleId: 'v2',
        vehiclePlate: 'Alfa Romeo (AA111BB)',
        date: {} as any,
        details: {}
      }
    ];

    component.searchTerm = '70459';
    let filtered = component.getFilteredContracts(mockContracts);
    expect(filtered.length).toBe(1);
    expect(filtered[0].customerName).toBe('Mario Rossi');

    component.searchTerm = 'Alfa';
    filtered = component.getFilteredContracts(mockContracts);
    expect(filtered.length).toBe(1);
    expect(filtered[0].contractNumber).toBe('22345');
  });

  it('should filter by cargos status and sort correctly', () => {
    const mockContracts = [
      {
        id: '1',
        contractNumber: '10',
        customerName: 'Zaira Rossi',
        cargos_status: 'SENT',
        date: { seconds: 1000 } as any,
        details: {}
      },
      {
        id: '2',
        contractNumber: '5',
        customerName: 'Mario Bianchi',
        cargos_status: 'FAILED',
        date: { seconds: 5000 } as any,
        details: {}
      },
      {
        id: '3',
        contractNumber: '20',
        customerName: 'Alessandro Verdi',
        cargos_status: undefined,
        date: { seconds: 2000 } as any,
        details: {}
      }
    ] as any[];

    // Test Cargo filter
    component.statusFilter = 'SENT';
    let filtered = component.getFilteredContracts(mockContracts);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('1');

    component.statusFilter = 'FAILED';
    filtered = component.getFilteredContracts(mockContracts);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('2');

    component.statusFilter = 'NOT_SENT';
    filtered = component.getFilteredContracts(mockContracts);
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('3');

    // Reset Cargo filter
    component.statusFilter = 'ALL';

    // Test Sort by Contract Number Desc
    component.sortField = 'contractNumber';
    component.sortDirection = 'desc';
    filtered = component.getFilteredContracts(mockContracts);
    expect(filtered[0].contractNumber).toBe('20');
    expect(filtered[1].contractNumber).toBe('10');
    expect(filtered[2].contractNumber).toBe('5');

    // Test Sort by Contract Number Asc
    component.sortDirection = 'asc';
    filtered = component.getFilteredContracts(mockContracts);
    expect(filtered[0].contractNumber).toBe('5');
    expect(filtered[1].contractNumber).toBe('10');
    expect(filtered[2].contractNumber).toBe('20');

    // Test Sort by Customer Name Asc
    component.sortField = 'customerName';
    component.sortDirection = 'asc';
    filtered = component.getFilteredContracts(mockContracts);
    expect(filtered[0].customerName).toBe('Alessandro Verdi');
    expect(filtered[1].customerName).toBe('Mario Bianchi');
    expect(filtered[2].customerName).toBe('Zaira Rossi');
  });

  it('should initialize editing state correctly unless cargos_status is SENT', () => {
    const mockContractSent = {
      id: 'c1',
      contractNumber: '100',
      cargos_status: 'SENT',
      details: { baseRate: 150 }
    } as any;

    const mockContractUnsent = {
      id: 'c2',
      contractNumber: '101',
      cargos_status: 'CHECK_SUCCESS',
      details: { baseRate: 120 }
    } as any;

    // SENT contract should not be editable
    spyOn(window, 'alert');
    component.editContract(mockContractSent);
    expect(component.isEditModalOpen).toBeFalse();
    expect(window.alert).toHaveBeenCalledWith('Non puoi modificare un contratto che è già stato inviato con successo a Cargos!');

    // Unsent contract should be editable
    component.editContract(mockContractUnsent);
    expect(component.isEditModalOpen).toBeTrue();
    expect(component.editingContract).toBe(mockContractUnsent);
    expect(component.editedDetails.baseRate).toBe(120);
  });

  it('should auto-populate driver details on driver change', () => {
    component.availableCustomers = [
      {
        id: 'cust_999',
        firstName: 'Franco',
        lastName: 'Neri',
        birthPlace: 'Mottola',
        birthDate: { toDate: () => new Date('1990-01-01') } as any,
        licenseNumber: 'PAT123',
        licenseIssueDate: { toDate: () => new Date('2010-01-01') } as any,
        licenseExpiry: { toDate: () => new Date('2030-01-01') } as any,
        licenseReleasedBy: 'MCTC',
        licenseCountry: 'Italia'
      }
    ];

    component.editedDetails = { mainDriverId: 'cust_999' };
    component.onEditMainDriverChange();

    expect(component.editedDetails.driverBirthPlace).toBe('Mottola');
    expect(component.editedDetails.driverBirthDate).toBe('1990-01-01');
    expect(component.editedDetails.driverLicenseNumber).toBe('PAT123');
    expect(component.editedDetails.driverLicenseCountry).toBe('Italia');
  });

  it('should save edited contract, updating customerName and resetting Cargos status', async () => {
    component.availableCustomers = [
      { id: 'c_xyz', firstName: 'Luigi', lastName: 'Bianchi' }
    ];

    const mockContract = {
      id: 'c_id_1',
      contractNumber: '555',
      details: { baseRate: 100, mainDriverId: 'c_xyz' }
    } as any;

    component.editingContract = mockContract;
    component.editedDetails = { baseRate: 190, mainDriverId: 'c_xyz' };
    component.isEditModalOpen = true;

    await component.saveContractEdit();

    expect(mockRentalService.updateContract).toHaveBeenCalledWith('c_id_1', jasmine.objectContaining({
      details: { baseRate: 190, mainDriverId: 'c_xyz' },
      cargos_status: null as any,
      cargos_transaction_id: null as any,
      cargos_error: null as any,
      cargos_sync_time: null as any,
      pdfBase64: null as any,
      customerName: 'Luigi Bianchi'
    }));
    expect(component.isEditModalOpen).toBeFalse();
  });

  it('should format and update contratto_checkout_data and normalize time inputs during save', async () => {
    const mockContract = {
      id: 'c_id_2',
      contractNumber: '666',
      contratto_checkout_data: '15/08/2026 09.00',
      contratto_checkin_data: '22/08/2026 18.00',
      details: { baseRate: 100, mainDriverId: 'c_xyz', timeOut: '08.30', timeIn: '18.15' }
    } as any;

    component.editingContract = mockContract;
    component.editedDetails = { ...mockContract.details };
    component.isEditModalOpen = true;

    await component.saveContractEdit();

    expect(mockRentalService.updateContract).toHaveBeenCalledWith('c_id_2', jasmine.objectContaining({
      contratto_checkout_data: '15/08/2026 08:30',
      contratto_checkin_data: '22/08/2026 18:15',
    }));
  });

  it('should manage bulk selections and trigger bulk sending correctly', () => {
    const mockContracts = [
      { id: '1', contractNumber: '100', cargos_status: 'CHECK_SUCCESS' },
      { id: '2', contractNumber: '101', cargos_status: 'SENT' },
      { id: '3', contractNumber: '102', cargos_status: 'FAILED' }
    ] as any[];

    component.allContracts = mockContracts;

    // Single selection toggling
    component.toggleSelectContract('1');
    expect(component.isContractSelected('1')).toBeTrue();
    expect(component.isContractSelected('2')).toBeFalse();

    component.toggleSelectContract('1');
    expect(component.isContractSelected('1')).toBeFalse();

    // Select-all logic (excluding already SENT)
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBeTrue();
    expect(component.isContractSelected('1')).toBeTrue();
    expect(component.isContractSelected('2')).toBeFalse();
    expect(component.isContractSelected('3')).toBeTrue();

    // Deselect-all logic
    component.toggleSelectAll();
    expect(component.isAllSelected()).toBeFalse();
    expect(component.isContractSelected('1')).toBeFalse();
    expect(component.isContractSelected('3')).toBeFalse();

    // Bulk Send
    component.toggleSelectContract('1');
    component.toggleSelectContract('3');
    spyOn(window, 'confirm').and.returnValue(true);
    spyOn(window, 'alert');

    component.sendBulkContracts();

    expect(mockRentalService.sendBulkContracts).toHaveBeenCalledWith(['1', '3']);
    expect(component.isSendingBulk).toBeFalse();
    expect(component.selectedContractIds.size).toBe(0);
  });
});