import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Region = 'UK' | 'USA' | 'Canada' | 'Australia' | 'New Zealand' | 'EU';

export const getCurrencySymbol = (region: Region) => {
  switch (region) {
    case 'UK': return '£';
    case 'USA':
    case 'Canada':
    case 'Australia':
    case 'New Zealand': return '$';
    case 'EU': return '€';
    default: return '£';
  }
};

export const getRegionMultiplier = (region: Region) => {
  switch (region) {
    case 'UK': return 1;
    case 'USA': return 1.5;
    case 'EU': return 1.5;
    case 'Canada': return 2;
    case 'Australia': return 2;
    case 'New Zealand': return 3;
    default: return 1;
  }
};

export const formatPrice = (baseGbp: number, region: Region) => {
  const multiplier = getRegionMultiplier(region);
  const symbol = getCurrencySymbol(region);
  const converted = baseGbp * multiplier;
  
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: converted % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(converted);
  
  return `${symbol}${formatted}`;
};
