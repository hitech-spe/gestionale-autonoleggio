import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RemindersTabComponent } from './reminders-tab.component';
import { RentalService } from '../../../../services/rental.service';
import { of } from 'rxjs';
import { Timestamp } from '@angular/fire/firestore';

describe('RemindersTabComponent', () => {
  let component: RemindersTabComponent;
  let fixture: ComponentFixture<RemindersTabComponent>;
  let mockRentalService: any;

  beforeEach(async () => {
    mockRentalService = {
      getReminders: jasmine.createSpy('getReminders').and.returnValue(of([])),
      addReminder: jasmine.createSpy('addReminder').and.returnValue(Promise.resolve()),
      updateReminder: jasmine.createSpy('updateReminder').and.returnValue(Promise.resolve()),
      toggleReminderCompletion: jasmine.createSpy('toggleReminderCompletion').and.returnValue(Promise.resolve()),
      deleteReminder: jasmine.createSpy('deleteReminder').and.returnValue(Promise.resolve())
    };

    await TestBed.configureTestingModule({
      imports: [RemindersTabComponent],
      providers: [
        { provide: RentalService, useValue: mockRentalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RemindersTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format date correctly', () => {
    const testDate = new Date('2026-08-19T15:30:00');
    const mockTimestamp = Timestamp.fromDate(testDate);
    const formatted = component.formatDate(mockTimestamp);
    
    // Check that it includes "19" and "2026"
    expect(formatted).toContain('19');
    expect(formatted).toContain('2026');
  });

  it('should generate organic tilts', () => {
    const tilt0 = component.getTilt(0);
    const tilt1 = component.getTilt(1);
    
    expect(tilt0).toBe('rotate(-2deg)');
    expect(tilt1).toBe('rotate(1.5deg)');
  });

  it('should identify when early alert is active', () => {
    // Current time is now. Event is in 10 minutes. Early alert is set for 15 minutes before the event.
    // Therefore, the early alert is active!
    const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now
    const mockReminder = {
      text: 'Test early alert',
      date: Timestamp.fromDate(futureDate),
      alertBeforeValue: 15,
      alertBeforeUnit: 'minutes' as 'minutes',
      completed: false
    };

    expect(component.isAlertActive(mockReminder)).toBeTrue();

    // If completed is true, alert should not be active
    mockReminder.completed = true;
    expect(component.isAlertActive(mockReminder)).toBeFalse();
  });

  it('should generate correct alert description', () => {
    const mockReminder = {
      text: 'Test description',
      date: Timestamp.now(),
      alertBeforeValue: 2,
      alertBeforeUnit: 'hours' as 'hours'
    };

    const desc = component.getAlertDescription(mockReminder);
    expect(desc).toBe('Avviso impostato: 2 ore prima');
  });
});