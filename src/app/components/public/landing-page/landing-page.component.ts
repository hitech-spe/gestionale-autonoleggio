import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../services/loading.service';
import * as AOS from 'aos';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private loadingService = inject(LoadingService);

  isScrolled = false;

  @HostListener('window:scroll')
  onWindowScroll() {
    this.isScrolled = window.scrollY > 50;
  }

  contactData = {
    name: '',
    email: '',
    company: '',
    message: ''
  };

  formSubmitted = false;

  activePlaygroundTab = 'timeline';
  bookingStatus = 'attivo';
  contractStep = 'idle'; // 'idle' | 'generating' | 'ready'
  pecStep = 'idle'; // 'idle' | 'scanning' | 'ready'

  startContractDemo() {
    this.contractStep = 'generating';
    setTimeout(() => {
      this.contractStep = 'ready';
    }, 1500);
  }

  startPecDemo() {
    this.pecStep = 'scanning';
    setTimeout(() => {
      this.pecStep = 'ready';
    }, 1500);
  }

  ngOnInit() {
    AOS.init({
      duration: 1000,
      easing: 'ease-out-quart',
      once: true,
      offset: 120
    });

    // Intercepts Stripe redirection queries on the landing page and forwards the user directly to their active SaaS panel.
    this.route.queryParams.subscribe(params => {
      if (params['payment'] === 'success') {
        this.router.navigate(['/app/dashboard'], { queryParams: { payment: 'success' } });
      } else if (params['payment'] === 'cancel') {
        this.router.navigate(['/app/dashboard'], { queryParams: { payment: 'cancel' } });
      }
    });
  }

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

  onSubmitContact(event: Event) {
    event.preventDefault();

    if (this.contactData.name && this.contactData.email && this.contactData.message) {
      this.loadingService.show();

      const body = new URLSearchParams();
      body.set('form-name', 'contact');
      body.set('name', this.contactData.name);
      body.set('email', this.contactData.email);
      body.set('company', this.contactData.company || '');
      body.set('message', this.contactData.message);

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      })
      .then(() => {
        this.loadingService.hide();
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
      })
      .catch(err => {
        this.loadingService.hide();
        console.error('Errore durante l\'invio del form Netlify:', err);
        alert('Si è verificato un errore durante l\'invio della richiesta. Riprova più tardi.');
      });
    }
  }
}
