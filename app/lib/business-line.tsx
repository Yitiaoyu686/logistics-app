import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BusinessLine = 'SEA' | 'AIR';

const STORAGE_KEY = 'businessLine';

interface BusinessLineContextValue {
  businessLine: BusinessLine;
  setBusinessLine: (v: BusinessLine) => void;
  isSea: boolean;
  isAir: boolean;
  toggle: () => void;
}

const BusinessLineContext = createContext<BusinessLineContextValue>({
  businessLine: 'SEA',
  setBusinessLine: () => {},
  isSea: true,
  isAir: false,
  toggle: () => {},
});

export function BusinessLineProvider({ children }: { children: ReactNode }) {
  const [businessLine, setBusinessLineState] = useState<BusinessLine>('SEA');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'AIR' || v === 'SEA') setBusinessLineState(v);
      setReady(true);
    });
  }, []);

  const setBusinessLine = useCallback((v: BusinessLine) => {
    setBusinessLineState(v);
    AsyncStorage.setItem(STORAGE_KEY, v);
  }, []);

  const toggle = useCallback(() => {
    setBusinessLine(businessLine === 'SEA' ? 'AIR' : 'SEA');
  }, [businessLine, setBusinessLine]);

  if (!ready) return null;

  return (
    <BusinessLineContext.Provider
      value={{ businessLine, setBusinessLine, isSea: businessLine === 'SEA', isAir: businessLine === 'AIR', toggle }}
    >
      {children}
    </BusinessLineContext.Provider>
  );
}

export function useBusinessLine(): BusinessLineContextValue {
  return useContext(BusinessLineContext);
}
