import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent {
  contactData = {
    name: '',
    email: '',
    company: '',
    message: ''
  };

  formSubmitted = false;

  faqs = [
    {
      question: 'Come funziona il periodo di prova?',
      answer: 'Offriamo 14 giorni di prova gratuita senza carta di credito obbligatoria. Puoi registrare la tua azienda, configurare la flotta e testare tutte le funzionalità incluse nel piano Starter.',
      open: false
    },
    {
      question: 'Posso cambiare piano di abbonamento in qualsiasi momento?',
      answer: 'Sì, puoi effettuare l\'upgrade o il downgrade del tuo abbonamento direttamente dalla sezione fatturazione del tuo account. Eventuali modifiche saranno calcolate proporzionalmente sul ciclo di fatturazione successivo.',
      open: false
    },
    {
      question: 'I nostri dati sono al sicuro?',
      answer: 'Assolutamente sì. Ogni azienda dispone di un database isolato logico (multi-tenant) e tutte le connessioni sono cifrate tramite protocollo SSL. I dati sono ospitati sui server sicuri di Google Cloud / Firebase con backup giornalieri automatici.',
      open: false
    },
    {
      question: 'Cos\'è l\'integrazione Cargos e come funziona?',
      answer: 'In Italia, le aziende di autonoleggio devono obbligatoriamente inviare i dati dei contratti attivi alla Polizia di Stato tramite il portale Cargos. Il nostro piano Pro include l\'esportazione e l\'invio automatico in 1 click dei dati mappati direttamente dai tuoi contratti, evitando inserimenti manuali sul portale ministeriale.',
      open: false
    },
    {
      question: 'Come avviene la gestione dei verbali tramite PEC?',
      answer: 'Il modulo avanzato Enterprise ti permette di caricare i PDF dei verbali ricevuti (multe). Il sistema estrae i dati dell\'infrazione (data, ora, targa, numero verbale) e individua il contratto di noleggio attivo in quel momento. Genera quindi automaticamente la PEC da inviare all\'autorità emittente per la notifica del verbale al reale conducente.',
      open: false
    }
  ];

  toggleFaq(index: number) {
    this.faqs[index].open = !this.faqs[index].open;
  }

  onSubmitContact() {
    if (this.contactData.name && this.contactData.email && this.contactData.message) {
      // In a real application, we would send this to EmailJS or an API endpoint.
      console.log('Messaggio di contatto inviato:', this.contactData);
      this.formSubmitted = true;
      
      // Reset form
      this.contactData = {
        name: '',
        email: '',
        company: '',
        message: ''
      };

      setTimeout(() => {
        this.formSubmitted = false;
      }, 5000);
    }
  }
}
