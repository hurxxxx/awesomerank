export type ConsentStatus = 'pending' | 'accepted' | 'rejected';

export interface ConsentState {
  status: ConsentStatus;
  timestamp: string | null;
  region: string | null; // EU, US, KR, BR, JP, OTHER
}

export interface ConsentContextType {
  consent: ConsentState;
  isConsentRequired: boolean;
  isOptInRegion: boolean;
  acceptConsent: () => void;
  rejectConsent: () => void;
  resetConsent: () => void;
  canCollectData: () => boolean;
}
