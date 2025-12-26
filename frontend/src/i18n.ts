import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ko from './locales/ko.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

export const languages = [
    { code: 'en', label: 'English' },
    { code: 'ko', label: '한국어' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
];

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            ko: { translation: ko },
            es: { translation: es },
            pt: { translation: pt },
        },
        fallbackLng: 'en',
        keySeparator: false,
        nsSeparator: false,
        returnEmptyString: false,
        returnNull: false,
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['navigator', 'htmlTag', 'path', 'subdomain'],
        },
    });

export default i18n;
