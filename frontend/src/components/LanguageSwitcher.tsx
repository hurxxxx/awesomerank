import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { languages } from '../i18n';
import './LanguageSwitcher.css';

interface LanguageSwitcherProps {
    compact?: boolean;
}

export const LanguageSwitcher = ({ compact = false }: LanguageSwitcherProps) => {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const currentLang = languages.find(l => i18n.language?.startsWith(l.code)) || languages[0];

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    const handleLanguageChange = (code: string) => {
        i18n.changeLanguage(code);
        setIsOpen(false);
    };

    return (
        <>
            <button
                className={`lang-trigger-btn ${compact ? 'lang-trigger-compact' : ''}`}
                onClick={() => setIsOpen(true)}
                aria-label={t('Select language')}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                {!compact && <span className="lang-label">{currentLang.label}</span>}
                {compact && <span className="lang-code">{currentLang.code.toUpperCase()}</span>}
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            <motion.div
                                className="lang-modal-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => setIsOpen(false)}
                            />
                            <div className="lang-modal-wrapper">
                                <motion.div
                                    className="lang-modal"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                                >
                                <div className="lang-modal-header">
                                    <h3 className="lang-modal-title">{t('Select Language')}</h3>
                                    <button
                                        className="lang-modal-close"
                                        onClick={() => setIsOpen(false)}
                                        aria-label={t('Close')}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="lang-modal-content">
                                    <div className="lang-grid">
                                        {languages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                className={`lang-option ${i18n.language?.startsWith(lang.code) ? 'active' : ''}`}
                                                onClick={() => handleLanguageChange(lang.code)}
                                            >
                                                <span className="lang-option-label">{lang.label}</span>
                                                <span className="lang-option-code">{lang.code.toUpperCase()}</span>
                                                {i18n.language?.startsWith(lang.code) && (
                                                    <span className="lang-check">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                </motion.div>
                            </div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};
