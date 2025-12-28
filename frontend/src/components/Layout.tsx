import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import './Layout.css';

interface LayoutProps {
    children: React.ReactNode;
    showBack?: boolean;
    showHome?: boolean;
    onBack?: () => void;
    onHome?: () => void;
    currentApp?: string;
    onSelectApp?: (appId: string) => void;
}


export const Layout = ({ children, showBack, showHome, onBack, onHome, currentApp, onSelectApp }: LayoutProps) => {
    const { t } = useTranslation();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Lock body scroll when sidebar is open
    useEffect(() => {
        if (sidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [sidebarOpen]);

    // Close sidebar on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSidebarOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    const handleShare = async () => {
        const shareData = {
            title: t('Awesome Rank'),
            text: t('Check out Awesome Rank!'),
            url: window.location.href,
        };
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    console.error('Share failed:', err);
                }
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
            } catch (err) {
                console.error('Copy failed:', err);
            }
        }
    };

    const handleAppSelect = (appId: string) => {
        setSidebarOpen(false);
        if (onSelectApp) {
            onSelectApp(appId);
        }
    };

    return (
        <div className="layout">
            {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        <motion.div
                            className="sidebar-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setSidebarOpen(false)}
                        />
                        <motion.aside
                            className="sidebar"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        >
                            <div className="sidebar-header">
                                <div className="sidebar-brand">
                                    <span className="brand-icon">✦</span>
                                    <span className="brand-text">Awesome Rank</span>
                                </div>
                                <button
                                    className="sidebar-close"
                                    onClick={() => setSidebarOpen(false)}
                                    aria-label={t('Close menu')}
                                >
                                    ✕
                                </button>
                            </div>
                            <nav className="sidebar-nav">
                                <div className="sidebar-section-title">{t('Apps')}</div>
                                <button
                                    className={`sidebar-item ${currentApp === 'world-rank' ? 'active' : ''}`}
                                    onClick={() => handleAppSelect('world-rank')}
                                >
                                    <span className="sidebar-item-icon">🌍</span>
                                    <div className="sidebar-item-content">
                                        <span className="sidebar-item-label">{t('World Rank')}</span>
                                        <span className="sidebar-item-desc">{t('Discover your place in the world')}</span>
                                    </div>
                                </button>
                                <button
                                    className={`sidebar-item ${currentApp === 'income-rank' ? 'active' : ''}`}
                                    onClick={() => handleAppSelect('income-rank')}
                                >
                                    <span className="sidebar-item-icon">💰</span>
                                    <div className="sidebar-item-content">
                                        <span className="sidebar-item-label">{t('Living Standard Rank')}</span>
                                        <span className="sidebar-item-desc">{t('Compare your income globally')}</span>
                                    </div>
                                </button>
                                <button
                                    className={`sidebar-item ${currentApp === 'country-compare' ? 'active' : ''}`}
                                    onClick={() => handleAppSelect('country-compare')}
                                >
                                    <span className="sidebar-item-icon">🗺️</span>
                                    <div className="sidebar-item-content">
                                        <span className="sidebar-item-label">{t('Country Size Compare')}</span>
                                        <span className="sidebar-item-desc">{t('Compare country sizes')}</span>
                                    </div>
                                </button>
                                <button
                                    className={`sidebar-item ${currentApp === 'global-stats' ? 'active' : ''}`}
                                    onClick={() => handleAppSelect('global-stats')}
                                >
                                    <span className="sidebar-item-icon">📊</span>
                                    <div className="sidebar-item-content">
                                        <span className="sidebar-item-label">{t('Global Statistics')}</span>
                                        <span className="sidebar-item-desc">{t('Explore world statistics')}</span>
                                    </div>
                                </button>
                            </nav>
                            <div className="sidebar-footer">
                                <div className="sidebar-settings">
                                    <ThemeToggle />
                                    <LanguageSwitcher />
                                </div>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            <header className="layout-header">
                <div className="header-left">
                    {onSelectApp && (
                        <motion.button
                            className="header-btn header-btn-menu"
                            onClick={() => setSidebarOpen(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label={t('Open menu')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </motion.button>
                    )}
                    {showBack && onBack && (
                        <motion.button
                            className="header-btn"
                            onClick={onBack}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label={t('Back')}
                        >
                            ←
                        </motion.button>
                    )}
                    {!onSelectApp && !showBack && (
                        <div className="header-brand">
                            <span className="brand-icon">✦</span>
                            <span className="brand-text">Awesome Rank</span>
                        </div>
                    )}
                </div>
                <div className="header-right">
                    <LanguageSwitcher compact />
                    <motion.button
                        className="header-btn header-btn-share"
                        onClick={handleShare}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={t('Share')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                    </motion.button>
                    {showHome && onHome && (
                        <motion.button
                            className="header-btn"
                            onClick={onHome}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            aria-label={t('Home')}
                        >
                            ⌂
                        </motion.button>
                    )}
                </div>
            </header>

            <main className="layout-main">
                <div className="layout-content">
                    {children}
                </div>
            </main>

            <footer className="layout-footer">
                <span className="footer-brand">{t('Awesome Rank')}</span>
                <a
                    href="https://github.com/hurxxxx/worldrank"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-github"
                    aria-label={t('GitHub')}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                </a>
            </footer>
        </div>
    );
};
