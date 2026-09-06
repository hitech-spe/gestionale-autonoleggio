import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerbaliTabComponent } from './verbali-tab.component';
import { RentalService } from '../../../../services/rental.service';
import { Firestore } from '@angular/fire/firestore';
import { of } from 'rxjs';

describe('VerbaliTabComponent', () => {
  let component: VerbaliTabComponent;
  let fixture: ComponentFixture<VerbaliTabComponent>;
  let mockRentalService: any;
  let mockFirestore: any;

  beforeEach(async () => {
    mockRentalService = {
      getVerbali: jasmine.createSpy('getVerbali').and.returnValue(of([])),
      getContracts: jasmine.createSpy('getContracts').and.returnValue(of([])),
      getRentals: jasmine.createSpy('getRentals').and.returnValue(of([])),
      getCustomers: jasmine.createSpy('getCustomers').and.returnValue(of([])),
      createVerbale: jasmine.createSpy('createVerbale').and.returnValue(Promise.resolve({ id: 'mock-id' })),
      updateVerbale: jasmine.createSpy('updateVerbale').and.returnValue(Promise.resolve()),
      deleteVerbale: jasmine.createSpy('deleteVerbale').and.returnValue(Promise.resolve()),
      sendVerbalePec: jasmine.createSpy('sendVerbalePec').and.returnValue(of({ success: true }))
    };

    mockFirestore = {};

    await TestBed.configureTestingModule({
      imports: [VerbaliTabComponent],
      providers: [
        { provide: RentalService, useValue: mockRentalService },
        { provide: Firestore, useValue: mockFirestore }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerbaliTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reset form correctly', () => {
    component.selectedFileName = 'test.pdf';
    component.violationDateStr = '2026-08-25';
    component.resetForm();
    expect(component.selectedFileName).toBe('');
    expect(component.violationDateStr).toBe('');
    expect(component.newVerbale.plate).toBe('');
  });

  it('should filter verbali based on search term', () => {
    component.verbali = [
      {
        id: 'v1',
        plate: 'AA123BB',
        violationDate: {} as any,
        ticketNumber: 'V-1111',
        authorityName: 'Polizia Locale',
        authorityPec: 'test1@pec.it',
        status: 'Nuovo'
      },
      {
        id: 'v2',
        plate: 'CC456DD',
        violationDate: {} as any,
        ticketNumber: 'V-2222',
        authorityName: 'Carabinieri',
        authorityPec: 'test2@pec.it',
        status: 'Nuovo',
        customerName: 'Mario Rossi'
      }
    ];

    component.searchTerm = 'Rossi';
    let filtered = component.getFilteredVerbali();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('v2');

    component.searchTerm = 'AA123';
    filtered = component.getFilteredVerbali();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('v1');
  });
});
