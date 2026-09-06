import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { RentalService, Reminder } from '../../../../services/rental.service';
import { LoadingService } from '../../../../services/loading.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-reminders-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reminders-tab.component.html',
  styleUrls: ['./reminders-tab.component.scss']
})
export class RemindersTabComponent implements OnInit {
  private rentalService = inject(RentalService);
  private loadingService = inject(LoadingService);

  reminders$!: Observable<Reminder[]>;
  filter: 'all' | 'active' | 'completed' = 'all';

  // Form & Modal states
  isModalOpen = false;
  isEditMode = false;
  editingReminderId?: string;

  newReminderText = '';
  newReminderDate = '';
  newReminderColor = '#fef08a'; // Pastel Yellow default
  newReminderRepeat: 'none' | 'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_8_hours' | 'every_12_hours' | 'daily' | 'weekly' | 'monthly' | 'yearly' = 'none';

  // Early alert configuration
  hasAlert = false;
  alertValue = 15;
  alertUnit: 'minutes' | 'hours' | 'days' = 'minutes';

  // Available beautiful pastel colors for post-its
  colorOptions = [
    { name: 'Giallo', hex: '#fef08a', textHex: '#854d0e', borderHex: '#fef08a' },
    { name: 'Verde', hex: '#bbf7d0', textHex: '#166534', borderHex: '#bbf7d0' },
    { name: 'Azzurro', hex: '#bfdbfe', textHex: '#1e40af', borderHex: '#bfdbfe' },
    { name: 'Rosa', hex: '#fbcfe8', textHex: '#9d174d', borderHex: '#fbcfe8' },
    { name: 'Arancione', hex: '#fed7aa', textHex: '#9a3412', borderHex: '#fed7aa' },
    { name: 'Viola', hex: '#e9d5ff', textHex: '#6b21a8', borderHex: '#e9d5ff' }
  ];

  ngOnInit() {
    this.loadReminders();
  }

  loadReminders() {
    this.loadingService.show();
    this.reminders$ = this.rentalService.getReminders().pipe(
      tap({
        next: () => this.loadingService.hide(),
        error: (err) => {
          console.error('Error loading reminders:', err);
          this.loadingService.hide();
        }
      })
    );
  }

  getFilteredReminders(reminders: Reminder[] | null): Reminder[] {
    if (!reminders) return [];
    
    // Ordina per data (cronologica)
    const sorted = [...reminders].sort((a, b) => a.date.seconds - b.date.seconds);

    if (this.filter === 'active') {
      return sorted.filter(r => !r.completed);
    } else if (this.filter === 'completed') {
      return sorted.filter(r => r.completed);
    }
    return sorted;
  }

  openModal(reminder?: Reminder) {
    if (reminder) {
      this.isEditMode = true;
      this.editingReminderId = reminder.id;
      this.newReminderText = reminder.text;
      this.newReminderColor = reminder.color || '#fef08a';
      this.newReminderRepeat = reminder.repeat || 'none';
      
      // Load alert info
      if (reminder.alertBeforeUnit && reminder.alertBeforeUnit !== 'none') {
        this.hasAlert = true;
        this.alertValue = reminder.alertBeforeValue || 15;
        this.alertUnit = reminder.alertBeforeUnit as 'minutes' | 'hours' | 'days';
      } else {
        this.hasAlert = false;
        this.alertValue = 15;
        this.alertUnit = 'minutes';
      }

      // Convert Timestamp to YYYY-MM-DDTHH:MM for input type="datetime-local"
      if (reminder.date) {
        const d = reminder.date.toDate();
        // Adjust for timezone to avoid off-by-one errors
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
        this.newReminderDate = localISOTime;
      } else {
        this.newReminderDate = '';
      }
    } else {
      this.isEditMode = false;
      this.editingReminderId = undefined;
      this.newReminderText = '';
      this.newReminderColor = '#fef08a';
      this.newReminderRepeat = 'none';
      this.hasAlert = false;
      this.alertValue = 15;
      this.alertUnit = 'minutes';
      // Default to current date and time + 1 hour, rounded to nearest 5 mins
      const now = new Date();
      now.setHours(now.getHours() + 1);
      const tzOffset = now.getTimezoneOffset() * 60000;
      this.newReminderDate = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.newReminderText = '';
    this.newReminderDate = '';
    this.newReminderColor = '#fef08a';
    this.newReminderRepeat = 'none';
    this.editingReminderId = undefined;
    this.hasAlert = false;
    this.alertValue = 15;
    this.alertUnit = 'minutes';
  }

  async saveReminder() {
    if (!this.newReminderText.trim() || !this.newReminderDate) {
      alert('Inserisci sia il testo che la data/ora del promemoria.');
      return;
    }

    try {
      this.loadingService.show();
      const targetDate = new Date(this.newReminderDate);
      const data: Reminder = {
        text: this.newReminderText.trim(),
        date: Timestamp.fromDate(targetDate),
        color: this.newReminderColor,
        completed: this.isEditMode ? false : false, // New or edited defaults/resets to not completed
        alertBeforeValue: this.hasAlert ? this.alertValue : 0,
        alertBeforeUnit: this.hasAlert ? this.alertUnit : 'none',
        repeat: this.newReminderRepeat
      };

      if (this.isEditMode && this.editingReminderId) {
        await this.rentalService.updateReminder(this.editingReminderId, data);
      } else {
        await this.rentalService.addReminder(data);
      }
      this.loadingService.hide();
      this.closeModal();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore nel salvataggio del promemoria:', error);
      alert('Si è verificato un errore durante il salvataggio.');
    }
  }

  async toggleComplete(reminder: Reminder, event: Event) {
    event.stopPropagation(); // Avoid triggering any other click
    if (!reminder.id) return;
    try {
      this.loadingService.show();
      await this.rentalService.toggleReminderCompletion(reminder);
      this.loadingService.hide();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore nell\'aggiornamento del promemoria:', error);
    }
  }

  async deleteReminder(id: string, event: Event) {
    event.stopPropagation();
    if (!confirm('Sei sicuro di voler eliminare questo promemoria?')) return;
    try {
      this.loadingService.show();
      await this.rentalService.deleteReminder(id);
      this.loadingService.hide();
    } catch (error) {
      this.loadingService.hide();
      console.error('Errore nell\'eliminazione del promemoria:', error);
    }
  }

  // Gives a nice organic feel by rotation of post-its
  getTilt(index: number): string {
    const tilts = [-2, 1.5, -1, 2, -1.5, 1];
    const deg = tilts[index % tilts.length];
    return `rotate(${deg}deg)`;
  }

  isPast(timestamp: Timestamp): boolean {
    if (!timestamp) return false;
    return timestamp.toDate().getTime() < Date.now();
  }

  formatDate(timestamp: Timestamp): string {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const options: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('it-IT', options);
  }

  getRelativeTime(timestamp: Timestamp, completed?: boolean): string {
    if (!timestamp || completed) return '';
    
    const diffMs = timestamp.toDate().getTime() - Date.now();
    const isOverdue = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);
    
    const diffMinutes = Math.floor(absDiffMs / (1000 * 60));
    const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

    if (isOverdue) {
      if (diffMinutes < 60) return `Scaduto da ${diffMinutes} min`;
      if (diffHours < 24) return `Scaduto da ${diffHours} ore`;
      return `Scaduto da ${diffDays} giorni`;
    } else {
      if (diffMinutes < 60) return `Scade tra ${diffMinutes} min`;
      if (diffHours < 24) return `Scade tra ${diffHours} ore`;
      return `Scade tra ${diffDays} giorni`;
    }
  }

  isAlertActive(reminder: Reminder): boolean {
    if (reminder.completed) return false;
    if (!reminder.alertBeforeUnit || reminder.alertBeforeUnit === 'none' || !reminder.alertBeforeValue) return false;
    
    let offsetMs = 0;
    const val = reminder.alertBeforeValue;
    switch (reminder.alertBeforeUnit) {
      case 'minutes':
        offsetMs = val * 60 * 1000;
        break;
      case 'hours':
        offsetMs = val * 60 * 60 * 1000;
        break;
      case 'days':
        offsetMs = val * 24 * 60 * 60 * 1000;
        break;
    }
    
    const now = Date.now();
    const targetTime = reminder.date.toDate().getTime();
    const alertTime = targetTime - offsetMs;
    
    return now >= alertTime && now < targetTime;
  }

  getAlertDescription(reminder: Reminder): string {
    if (!reminder.alertBeforeUnit || reminder.alertBeforeUnit === 'none' || !reminder.alertBeforeValue) return '';
    const unitLabel = reminder.alertBeforeUnit === 'minutes' ? 'minuti' : 
                      reminder.alertBeforeUnit === 'hours' ? 'ore' : 'giorni';
    return `Avviso impostato: ${reminder.alertBeforeValue} ${unitLabel} prima`;
  }

  getRepeatDescription(repeat?: string): string {
    switch (repeat) {
      case 'hourly': return 'Ripetizione: Ogni ora';
      case 'every_2_hours': return 'Ripetizione: Ogni 2 ore';
      case 'every_4_hours': return 'Ripetizione: Ogni 4 ore';
      case 'every_8_hours': return 'Ripetizione: Ogni 8 ore';
      case 'every_12_hours': return 'Ripetizione: Ogni 12 ore';
      case 'daily': return 'Ripetizione: Ogni giorno';
      case 'weekly': return 'Ripetizione: Ogni settimana';
      case 'monthly': return 'Ripetizione: Ogni mese';
      case 'yearly': return 'Ripetizione: Ogni anno';
      default: return '';
    }
  }

  getColorStyle(colorHex: string) {
    const option = this.colorOptions.find(o => o.hex === colorHex) || this.colorOptions[0];
    return {
      'background-color': option.hex,
      'color': option.textHex,
      'border-color': option.borderHex
    };
  }
}