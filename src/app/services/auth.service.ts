import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_CONFIG } from '../config/api.config';
import { 
  Auth, 
  authState, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  User 
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp 
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, of, from, firstValueFrom } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';

export interface Company {
  id: string;
  name: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'trial';
  createdAt: Timestamp;
  // White-labeling & Branding customization fields
  logoUrl?: string;
  primaryColor?: string; // Hex color for primary UI accents (e.g. "--accent")
  secondaryColor?: string; // Hex color for secondary UI accents (e.g. "--accent-hover")
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
  piva?: string;
  locations?: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role: 'owner' | 'admin' | 'operator';
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root',
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

  // Cached synchronous value for easy injection in services
  private _companyId: string | null = null;

  constructor() {
    // Automatically load profile and company whenever authState changes
    this.user$.pipe(
      switchMap(user => {
        if (!user) {
          this._companyId = null;
          this.userProfileSubject.next(null);
          this.currentCompanySubject.next(null);
          return of(null);
        }
        
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
                })
              );
            } else {
              // Fallback for direct logins or unprofiled accounts (e.g. legacy/development)
              console.warn('Profilo utente non trovato su Firestore.');
              // For direct backwards compatibility with same Firebase DB:
              this._companyId = 'dolcevita-legacy'; 
              this.currentCompanySubject.next({
                id: 'dolcevita-legacy',
                name: 'Dolce Vita Legacy',
                plan: 'enterprise',
                status: 'active',
                createdAt: Timestamp.now()
              });
              return of(null);
            }
          })
        );
      })
    ).subscribe();
  }

  getCurrentCompanyId(): string {
    if (!this._companyId) {
      // In development or prior to profile resolution, return a default/fallback
      return 'dolcevita-legacy';
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
    return ['Mottola', 'Massafra', 'Grottaglie']; // Default fallback locations
  }

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
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
    // so the initial ID token retrieved will immediately contain them, loading the profile instantly!
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);

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
    if (currentCompany && currentCompany.id === companyId) {
      const updated = { ...currentCompany, ...data };
      this.currentCompanySubject.next(updated);
    }
  }
}
