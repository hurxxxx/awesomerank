import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useConsent } from '../contexts/useConsent';
import './ConsentBanner.css';

export function ConsentBanner() {
  const { t } = useTranslation();
  const { consent, isConsentRequired, isOptInRegion, acceptConsent, rejectConsent } = useConsent();

  // Don't show if consent already given
  if (!isConsentRequired) {
    return null;
  }

  return (
    <AnimatePresence>
      {consent.status === 'pending' && (
        <motion.div
          className="consent-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="consent-banner"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="consent-content">
              <h3 className="consent-title">{t('Privacy Notice')}</h3>
              <p className="consent-text">
                {t('consent_description')}
              </p>
              <ul className="consent-data-list">
                <li>{t('consent_data_demographics')}</li>
                <li>{t('consent_data_responses')}</li>
                <li>{t('consent_data_device')}</li>
                <li>{t('consent_data_location')}</li>
              </ul>
              <p className="consent-note">
                {t('consent_purpose')}
              </p>
              <a href="/privacy" className="consent-link" target="_blank" rel="noopener noreferrer">
                {t('Read Privacy Policy')}
              </a>
            </div>

            <div className="consent-actions">
              {isOptInRegion ? (
                // Opt-in regions: Require explicit acceptance
                <>
                  <button
                    className="consent-btn consent-btn-accept"
                    onClick={acceptConsent}
                  >
                    {t('Accept')}
                  </button>
                  <button
                    className="consent-btn consent-btn-reject"
                    onClick={rejectConsent}
                  >
                    {t('Decline')}
                  </button>
                </>
              ) : (
                // Opt-out regions: Different wording
                <>
                  <button
                    className="consent-btn consent-btn-accept"
                    onClick={acceptConsent}
                  >
                    {t('Continue')}
                  </button>
                  <button
                    className="consent-btn consent-btn-reject"
                    onClick={rejectConsent}
                  >
                    {t('Do Not Collect My Data')}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
