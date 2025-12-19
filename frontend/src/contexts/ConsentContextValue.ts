import { createContext } from 'react';
import type { ConsentContextType } from './consentTypes';

export const ConsentContext = createContext<ConsentContextType | null>(null);
