import { Injectable, inject } from '@angular/core';
import { Auth, User, authState, signInWithEmailAndPassword, signOut, signInWithPopup } from '@angular/fire/auth';
import { GoogleAuthProvider } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, Timestamp } from '@angular/fire/firestore';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, from, firstValueFrom } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';

export interface Company {
  id: string;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
  piva?: string;
  locations?: string[];

  // Feature flags activation states
  enableCargos?: boolean;
  enableVerbaliPec?: boolean;
  pecEmail?: string;

  // Subscription and payment states
  status: 'trial' | 'active' | 'suspended';
  plan: 'starter' | 'pro' | 'enterprise';
  createdAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: 'owner' | 'admin' | 'staff';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private http = inject(HttpClient);

  user$: Observable<User | null> = authState(this.auth);

  private currentCompanySubject = new BehaviorSubject<Company | null>(null);
  currentCompany$ = this.currentCompanySubject.asObservable();

  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  userProfile$ = this.userProfileSubject.asObservable();

  // Onboarding stream for new Google Signups
  public googleOnboardingUser$ = new BehaviorSubject<User | null>(null);

  // Cached synchronous value for easy injection in services
  private _companyId: string | null = null;

  constructor() {
    // Automatically load profile and company whenever authState changes
    this.user$.pipe(
      switchMap(async user => {
        if (!user) {
          this._companyId = null;
          this.userProfileSubject.next(null);
          this.currentCompanySubject.next(null);
          return null;
        }

        try {
          // Check if token already contains the companyId claim. If not, trigger a force refresh.
          const idTokenResult = await user.getIdTokenResult();
          if (!idTokenResult.claims['companyId']) {
            console.log('Rilevati custom claims mancanti nel token attivo. Tento un force-refresh...');
            await user.getIdToken(true);
          }
        } catch (e) {
          console.error('Errore durante la verifica/refresh dei claims:', e);
        }
        return user;
      }),
      switchMap(user => {
        if (!user) return of(null);

        // Fetch user profile from firestore
        const profileRef = doc(this.firestore, `users/${user.uid}`);
        return from(getDoc(profileRef)).pipe(
          switchMap(profileSnap => {
            if (profileSnap.exists()) {
              const profile = profileSnap.data() as UserProfile;
              this.userProfileSubject.next(profile);
              this._companyId = profile.companyId;

              // Fetch company details
              const companyRef = doc(this.firestore, `companies/${profile.companyId}`);
              return from(getDoc(companyRef)).pipe(
                tap(companySnap => {
                  if (companySnap.exists()) {
                    this.currentCompanySubject.next(companySnap.data() as Company);
                  }
                }),
                catchError(err => {
                  console.error('Errore nel caricamento dei dettagli azienda:', err);
                  return of(null);
                })
              );
            } else {
              console.warn('Profilo utente non trovato su Firestore.');
              // Trigger Google Onboarding flow
              this.googleOnboardingUser$.next(user);
              this._companyId = null;
              this.userProfileSubject.next(null);
              this.currentCompanySubject.next(null);
              return of(null);
            }
          }),
          catchError(err => {
            console.error('Errore nel caricamento del profilo utente da Firestore:', err);
            // Non bloccare lo stream globale in caso di ritardi temporanei dei token claim
            return of(null);
          })
        );
      })
    ).subscribe();
  }

  getCompanyProfile(): Company | null {
    return this.currentCompanySubject.value;
  }

  getCurrentCompanyId(): string {
    if (!this._companyId) {
      throw new Error('Nessun ID azienda associato all\'utente corrente.');
    }
    return this._companyId;
  }

  getCompanyPlan(): 'starter' | 'pro' | 'enterprise' {
    const comp = this.currentCompanySubject.value;
    return comp ? comp.plan : 'starter';
  }

  get companyLocations(): string[] {
    const comp = this.currentCompanySubject.value;
    if (comp && comp.locations && comp.locations.length > 0) {
      return comp.locations;
    }
    return [];
  }

  async login(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    if (cred.user) {
      // Force refresh the token to load brand new backend claims immediately on login
      await cred.user.getIdToken(true);
    }
    return cred;
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    if (cred.user) {
      await cred.user.getIdToken(true);

      // Check if profile exists in Firestore
      const profileRef = doc(this.firestore, `users/${cred.user.uid}`);
      const profileSnap = await getDoc(profileRef);

      return {
        user: cred.user,
        isNewUser: !profileSnap.exists()
      };
    }
    throw new Error('Impossibile autenticare l\'utente con Google.');
  }

  async onboardGoogleUser(companyName: string, location: string, plan: string, subscribeImmediately: boolean = false) {
    const user = this.googleOnboardingUser$.value;
    if (!user) throw new Error('Nessun utente Google in attesa di onboarding.');

    // 1. Get Firebase ID Token
    const idToken = await user.getIdToken(true);

    const payload = {
      companyName,
      location,
      plan,
      subscribeImmediately
    };

    const headers = {
      'Authorization': `Bearer ${idToken}`
    };

    // 2. Send Onboarding request to Spring Boot Backend
    const response = await firstValueFrom(
      this.http.post<any>(`${API_CONFIG.baseUrl}/api/auth/google-onboard`, payload, { headers })
    );

    // 3. Force refresh the Firebase ID Token to fetch new 'companyId' custom claims set by BE
    await user.getIdToken(true);

    // 4. Manually fetch and emit Firestore records locally to bypass replica delays!
    try {
      const companyId = response.companyId || 'comp_' + Math.random().toString(36).substring(2, 11);
      this._companyId = companyId;

      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        firstName: user.displayName?.split(' ')[0] || 'Admin',
        lastName: user.displayName?.split(' ').slice(1).join(' ') || 'RentSmart',
        companyId: companyId,
        role: 'admin'
      };

      const company: Company = {
        id: companyId,
        name: companyName,
        plan: plan as any,
        status: 'trial',
        locations: location ? [location] : [],
        createdAt: Timestamp.now()
      };

      this.userProfileSubject.next(profile);
      this.currentCompanySubject.next(company);
    } catch (e) {
      console.error('Errore durante la pre-popolazione manuale:', e);
    }

    // 5. Clear onboarding state to trigger main stream reload
    this.googleOnboardingUser$.next(null);
    return response;
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    companyName: string,
    plan: 'starter' | 'pro' | 'enterprise' = 'starter'
  ) {
    // 1. Call Spring Boot backend to register user and set up company and claims
    const registerPayload = {
      email,
      password,
      firstName,
      lastName,
      companyName,
      plan
    };

    await firstValueFrom(
      this.http.post(`${API_CONFIG.baseUrl}/api/auth/register`, registerPayload)
    );

    // 2. Sign in using the client SDK. The backend has already set the custom claims,
    // so forcing a token refresh on sign-in ensures we load them instantly on first render.
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    if (userCredential.user) {
      await userCredential.user.getIdToken(true);
    }

    return userCredential;
  }

  logout() {
    this._companyId = null;
    this.userProfileSubject.next(null);
    this.currentCompanySubject.next(null);
    return signOut(this.auth);
  }

  async updateCompanySettings(companyId: string, data: Partial<Company>) {
    const companyRef = doc(this.firestore, `companies/${companyId}`);
    await setDoc(companyRef, data, { merge: true });

    // Update local cache to trigger real-time color and logo updates
    const currentCompany = this.currentCompanySubject.value;
    if (currentCompany) {
      this.currentCompanySubject.next({
        ...currentCompany,
        ...data
      });
    }
  }
}
