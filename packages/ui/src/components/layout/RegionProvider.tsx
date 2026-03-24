"use client";

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { Region } from '../../lib/utils';

export interface RegionContextType {
  region: Region;
  setRegion: (r: Region) => void;
}

export const RegionContext = createContext<RegionContextType | undefined>(undefined);

export function RegionProvider({ children }: { children: ReactNode }) {
  const [region, setRegion] = useState<Region>(() => {
    if (typeof window === 'undefined') return 'UK';
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('relentify-region') : null;
    return (saved as Region) || 'UK';
  });

  useEffect(() => {
    localStorage.setItem('relentify-region', region);
  }, [region]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('relentify-region');
    if (saved) return;

    const detectRegion = async () => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_code;
        
        if (countryCode === 'GB') setRegion('UK');
        else if (countryCode === 'US') setRegion('USA');
        else if (countryCode === 'CA') setRegion('Canada');
        else if (countryCode === 'AU') setRegion('Australia');
        else if (countryCode === 'NZ') setRegion('New Zealand');
        else if (['FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'IE', 'PT', 'SE', 'FI', 'DK'].includes(countryCode)) setRegion('EU');
      } catch (error) {
        console.error('Failed to detect region:', error);
      }
    };
    detectRegion();
  }, []);

  return (
    <RegionContext.Provider value={{ region, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}
