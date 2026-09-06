import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { VehicleSelectComponent } from './vehicle-select.component';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SimpleChange } from '@angular/core';
import { Vehicle } from '../../services/rental.service';

describe('VehicleSelectComponent', () => {
  let component: VehicleSelectComponent;
  let fixture: ComponentFixture<VehicleSelectComponent>;

  const mockVehicles: Vehicle[] = [
    { id: '1', brand: 'Fiat', model: '500', plate: 'AA111AA', category: 'Segmento A', status: 'Attivo', location: 'Mottola' },
    { id: '2', brand: 'Jeep', model: 'Renegade', plate: 'BB222BB', category: 'SUV', status: 'Attivo', location: 'Massafra' },
    { id: '3', brand: 'Fiat', model: 'Ducato', plate: 'CC333CC', category: 'Furgoni', status: 'Venduto', location: 'Mottola' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, FormsModule, VehicleSelectComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(VehicleSelectComponent);
    component = fixture.componentInstance;
    component.vehicles = mockVehicles;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should filter out sold vehicles by default', () => {
    component.excludeSold = true;
    const groups = component.groupedVehicles;
    // Fiat Ducato is sold, should not be included
    const allItems = groups.flatMap(g => g.items);
    expect(allItems.find(item => item.id === '3')).toBeUndefined();
    expect(allItems.length).toBe(2);
  });

  it('should search and filter vehicles correctly', () => {
    component.searchTerm = 'Renegade';
    const groups = component.groupedVehicles;
    const allItems = groups.flatMap(g => g.items);
    expect(allItems.length).toBe(1);
    expect(allItems[0].model).toBe('Renegade');
  });

  it('should group vehicles by category', () => {
    const groups = component.groupedVehicles;
    expect(groups.length).toBe(2); // Segmento A and SUV
    expect(groups[0].category).toBe('SUV'); // SUV is sorted before Segmento A alphabetically
  });

  it('should select vehicle and emit event on selectVehicle', () => {
    spyOn(component.vehicleIdChange, 'emit');
    component.selectVehicle(mockVehicles[0]);

    expect(component.vehicleId).toBe('1');
    expect(component.vehicleIdChange.emit).toHaveBeenCalledWith('1');
    expect(component.isOpen).toBeFalse();
  });

  it('should update search term when vehicleId input changes', () => {
    component.vehicleId = '2';
    component.ngOnChanges({
      vehicleId: new SimpleChange(null, '2', true)
    });
    fixture.detectChanges();
    expect(component.searchTerm).toContain('Jeep Renegade (BB222BB)');
  });
});
