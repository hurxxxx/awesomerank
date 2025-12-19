import { useState, useCallback, type ReactNode } from 'react';
import type { ConsentState } from './consentTypes';
import { ConsentContext } from './ConsentContextValue';

const CONSENT_STORAGE_KEY = 'world-rank-consent';

// Regions that require opt-in consent (explicit agreement before data collection)
const OPT_IN_REGIONS = ['EU', 'KR', 'BR'];

// Regions that use opt-out model (data collection allowed unless user opts out)
const OPT_OUT_REGIONS = ['US', 'JP'];

function getStoredConsent(): ConsentState | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

function storeConsent(consent: ConsentState) {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Ignore storage errors
  }
}

function clearStoredConsent() {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

// Detect user's region from timezone
function detectRegion(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // EU timezones
    const euTimezones = [
      'Europe/Amsterdam', 'Europe/Andorra', 'Europe/Athens', 'Europe/Belgrade',
      'Europe/Berlin', 'Europe/Bratislava', 'Europe/Brussels', 'Europe/Bucharest',
      'Europe/Budapest', 'Europe/Busingen', 'Europe/Copenhagen', 'Europe/Dublin',
      'Europe/Gibraltar', 'Europe/Helsinki', 'Europe/Kaliningrad', 'Europe/Kiev',
      'Europe/Lisbon', 'Europe/Ljubljana', 'Europe/London', 'Europe/Luxembourg',
      'Europe/Madrid', 'Europe/Malta', 'Europe/Monaco', 'Europe/Oslo',
      'Europe/Paris', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome',
      'Europe/San_Marino', 'Europe/Sarajevo', 'Europe/Skopje', 'Europe/Sofia',
      'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Tirane', 'Europe/Vaduz',
      'Europe/Vatican', 'Europe/Vienna', 'Europe/Vilnius', 'Europe/Warsaw',
      'Europe/Zagreb', 'Europe/Zurich', 'Atlantic/Canary', 'Atlantic/Faroe',
      'Atlantic/Madeira', 'Atlantic/Reykjavik'
    ];

    if (euTimezones.some(tz => timezone.startsWith(tz.split('/')[0]) && euTimezones.includes(timezone))) {
      return 'EU';
    }

    // Korea
    if (timezone === 'Asia/Seoul') {
      return 'KR';
    }

    // Brazil
    if (timezone.startsWith('America/') && [
      'America/Sao_Paulo', 'America/Rio_Branco', 'America/Manaus',
      'America/Cuiaba', 'America/Belem', 'America/Fortaleza',
      'America/Recife', 'America/Bahia', 'America/Maceio',
      'America/Campo_Grande', 'America/Porto_Velho', 'America/Boa_Vista',
      'America/Santarem', 'America/Araguaina', 'America/Noronha'
    ].includes(timezone)) {
      return 'BR';
    }

    // Japan
    if (timezone === 'Asia/Tokyo') {
      return 'JP';
    }

    // US timezones
    if (timezone.startsWith('America/') && [
      'America/New_York', 'America/Chicago', 'America/Denver',
      'America/Los_Angeles', 'America/Anchorage', 'America/Phoenix',
      'America/Detroit', 'America/Indiana', 'America/Kentucky',
      'Pacific/Honolulu'
    ].some(tz => timezone.startsWith(tz) || timezone === tz)) {
      return 'US';
    }

    // Check for common US timezone patterns
    if (timezone.startsWith('America/') &&
        !timezone.includes('Sao') && !timezone.includes('Buenos') &&
        !timezone.includes('Mexico') && !timezone.includes('Toronto') &&
        !timezone.includes('Vancouver')) {
      // Likely US or other Americas
      return 'US';
    }

  } catch {
    // Ignore detection errors
  }

  return 'OTHER';
}

interface ConsentProviderProps {
  children: ReactNode;
}

export function ConsentProvider({ children }: ConsentProviderProps) {
  const [consent, setConsent] = useState<ConsentState>(() => {
    const stored = getStoredConsent();
    if (stored) {
      return {
        status: stored.status ?? 'pending',
        timestamp: stored.timestamp ?? null,
        region: stored.region ?? detectRegion(),
      };
    }
    const region = detectRegion();
    return {
      status: 'pending',
      timestamp: null,
      region
    };
  });

  const region = consent.region ?? 'OTHER';

  const isOptInRegion = OPT_IN_REGIONS.includes(region);
  const isOptOutRegion = OPT_OUT_REGIONS.includes(region);

  // Consent banner is required in all regions, but behavior differs
  const isConsentRequired = consent.status === 'pending';

  const acceptConsent = useCallback(() => {
    const newConsent: ConsentState = {
      status: 'accepted',
      timestamp: new Date().toISOString(),
      region
    };
    setConsent(newConsent);
    storeConsent(newConsent);
  }, [region]);

  const rejectConsent = useCallback(() => {
    const newConsent: ConsentState = {
      status: 'rejected',
      timestamp: new Date().toISOString(),
      region
    };
    setConsent(newConsent);
    storeConsent(newConsent);
  }, [region]);

  const resetConsent = useCallback(() => {
    clearStoredConsent();
    setConsent({
      status: 'pending',
      timestamp: null,
      region
    });
  }, [region]);

  // Determine if data collection is allowed based on region and consent
  const canCollectData = useCallback(() => {
    // If user explicitly accepted, always allow
    if (consent.status === 'accepted') {
      return true;
    }

    // If user explicitly rejected, never allow
    if (consent.status === 'rejected') {
      return false;
    }

    // Pending state: depends on region
    // Opt-in regions (EU, KR, BR): cannot collect until explicit consent
    if (isOptInRegion) {
      return false;
    }

    // Opt-out regions (US, JP): can collect unless user opts out
    if (isOptOutRegion) {
      return true;
    }

    // Unknown regions: default to opt-in (safer approach)
    return false;
  }, [consent.status, isOptInRegion, isOptOutRegion]);

  return (
    <ConsentContext.Provider
      value={{
        consent,
        isConsentRequired,
        isOptInRegion,
        acceptConsent,
        rejectConsent,
        resetConsent,
        canCollectData
      }}
    >
      {children}
    </ConsentContext.Provider>
  );
}
