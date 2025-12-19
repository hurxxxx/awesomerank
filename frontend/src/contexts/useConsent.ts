import { useContext } from 'react';
import { ConsentContext } from './ConsentContextValue';

export const useConsent = () => {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within a ConsentProvider');
  }
  return context;
};
