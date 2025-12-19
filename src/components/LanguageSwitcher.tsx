import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const languages = [
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'it', label: 'Italiano' },
    { code: 'ru', label: 'Русский' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ar', label: 'العربية' },
    { code: 'id', label: 'Bahasa Indonesia' },
    { code: 'tr', label: 'Türkçe' },
];

export const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    return (
        <div className="language-switcher">
            {languages.map((lang) => (
                <button
                    key={lang.code}
                    className={`lang-btn ${i18n.language?.startsWith(lang.code) ? 'active' : ''}`}
                    onClick={() => i18n.changeLanguage(lang.code)}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
};
