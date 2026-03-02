import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useConsent } from '../contexts/useConsent';
import { buildLocalizedPath } from '../utils/localePath';
import './ConsentBanner.css';

export function ConsentBanner() {
  const { t, i18n } = useTranslation();
  const { consent, isConsentRequired, isOptInRegion, acceptConsent, rejectConsent } = useConsent();
  const language = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();
  const privacyHref = buildLocalizedPath('/privacy', language);

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
                {t('We collect anonymous data to provide better service and generate global statistics. The following information may be collected:')}
              </p>
              <ul className="consent-data-list">
                <li>{t('Age group and gender (optional)')}</li>
                <li>{t('Quiz responses, income input (calculator), and response times')}</li>
                <li>{t('Device type, screen size, browser language')}</li>
                <li>{t('Approximate location (country/city from IP)')}</li>
              </ul>
              <p className="consent-note">
                {t('Collected data is used only for research and service improvement purposes. We do not sell or share your personal information with third parties.')}
              </p>
              <a href={privacyHref} className="consent-link" target="_blank" rel="noopener noreferrer">
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
