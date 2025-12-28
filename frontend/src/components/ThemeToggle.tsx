import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './ThemeToggle.css';

type Theme = 'light' | 'dark' | 'system';

// Initialize theme on app load (runs once, outside component)
const getInitialTheme = (): Theme => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) return saved;
    // Default to dark if nothing saved
    localStorage.setItem('theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    return 'dark';
};

export const ThemeToggle = () => {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(current => current === 'dark' ? 'light' : 'dark');
    };

    const getCurrentIcon = () => {
        return theme === 'dark' ? 'moon' : 'sun';
    };

    const icon = getCurrentIcon();

    return (
        <motion.button
            className="theme-toggle"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={theme === 'system' ? 'Using system preference' : `${theme} mode`}
        >
            <div className="theme-toggle-track">
                <motion.div
                    className="theme-toggle-thumb"
                    animate={{
                        x: icon === 'sun' ? 0 : 20,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
                <span className={`theme-icon sun ${icon === 'sun' ? 'active' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                    </svg>
                </span>
                <span className={`theme-icon moon ${icon === 'moon' ? 'active' : ''}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                </span>
            </div>
        </motion.button>
    );
};
