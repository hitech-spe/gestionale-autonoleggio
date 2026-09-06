import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { RentalService } from '../../services/rental.service';
import { of } from 'rxjs';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let mockRentalService: any;

  beforeEach(async () => {
    mockRentalService = {
      getReminders: jasmine.createSpy('getReminders').and.returnValue(of([])),
      getVehicles: jasmine.createSpy('getVehicles').and.returnValue(of([])),
      getInsurances: jasmine.createSpy('getInsurances').and.returnValue(of([])),
      getInspections: jasmine.createSpy('getInspections').and.returnValue(of([])),
      getCustomers: jasmine.createSpy('getCustomers').and.returnValue(of([])),
      getContracts: jasmine.createSpy('getContracts').and.returnValue(of([])),
      getMaintenances: jasmine.createSpy('getMaintenances').and.returnValue(of([])),
      toggleReminderCompletion: jasmine.createSpy('toggleReminderCompletion').and.returnValue(Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        { provide: RentalService, useValue: mockRentalService }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get correct vehicle plate format', () => {
    // Set vehicles list
    (component as any).allVehicles = [
      { id: 'v123', brand: 'Fiat', model: '500', plate: 'AB123CD' }
    ];

    const mockIns = { vehicleId: 'v123', vehiclePlate: 'Fiat 500 (AB123CD)' };
    const plate1 = component.getVehiclePlate(mockIns);
    expect(plate1).toBe('AB123CD');

    const mockInsNoVehicle = { vehicleId: 'v999', vehiclePlate: 'Alfa Romeo (XY987ZT)' };
    const plate2 = component.getVehiclePlate(mockInsNoVehicle);
    expect(plate2).toBe('XY987ZT');

    const mockInsRawPlate = { vehicleId: 'v999', vehiclePlate: 'AB777CD' };
    const plate3 = component.getVehiclePlate(mockInsRawPlate);
    expect(plate3).toBe('AB777CD');
  });

  it('should navigate to insurance and set search/highlight parameters', fakeAsync(() => {
    const mockIns = { id: 'ins_abc', vehicleId: 'v123', vehiclePlate: 'Fiat 500 (AB123CD)' };
    
    component.navigateToInsurance(mockIns);

    expect(component.currentTab).toBe('insurance');
    expect(component.insuranceSearchTerm).toBe('AB123CD');
    expect(component.insuranceHighlightedId).toBe('ins_abc');

    // Wait 5 seconds for auto-clear
    tick(5000);
    expect(component.insuranceHighlightedId).toBe('');
  }));

  it('should navigate to inspection and set search/highlight parameters', fakeAsync(() => {
    const mockInsp = { id: 'insp_xyz', vehicleId: 'v456', vehiclePlate: 'Jeep Renegade (EF456GH)' };
    
    component.navigateToInspection(mockInsp);

    expect(component.currentTab).toBe('inspection');
    expect(component.inspectionSearchTerm).toBe('EF456GH');
    expect(component.inspectionHighlightedId).toBe('insp_xyz');

    // Wait 5 seconds for auto-clear
    tick(5000);
    expect(component.inspectionHighlightedId).toBe('');
  }));

  it('should clear parameters when manual tab navigation is selected', () => {
    component.insuranceSearchTerm = 'AB123CD';
    component.insuranceHighlightedId = 'ins_abc';

    component.onTabChange('insurance');

    expect(component.insuranceSearchTerm).toBe('');
    expect(component.insuranceHighlightedId).toBe('');
  });
});
