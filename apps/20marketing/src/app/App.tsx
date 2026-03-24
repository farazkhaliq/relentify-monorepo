import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { THEMES, Preset, ThemeConfig } from './themes';
import Home from './pages/Home';
import Accounting from './pages/Accounting';
import Inventory from './pages/Inventory';
import CRM from './pages/CRM';
import Blog from './pages/Blog';
import Timesheets from './pages/Timesheets';
import ESign from './pages/ESign';
import Reminders from './pages/Reminders';
import Payroll from './pages/Payroll';
import Websites from './pages/Websites';
import AlternativesHub from './pages/alternatives/AlternativesHub';
import XeroAlternative from './pages/alternatives/XeroAlternative';
import QuickBooksAlternative from './pages/alternatives/QuickBooksAlternative';
import XeroVsRelentify from './pages/alternatives/XeroVsRelentify';
import QuickBooksVsRelentify from './pages/alternatives/QuickBooksVsRelentify';
import Privacy from './pages/Privacy';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ThemeSwitcher from './components/ThemeSwitcher';
import CookieBanner from './components/CookieBanner';

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

interface ThemeContextType {
  preset: Preset;
  setPreset: (p: Preset) => void;
  theme: ThemeConfig;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

interface RegionContextType {
  region: Region;
  setRegion: (r: Region) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const RegionContext = createContext<RegionContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const useRegion = () => {
  const context = useContext(RegionContext);
  if (!context) throw new Error('useRegion must be used within RegionProvider');
  return context;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

export default function App() {
  const [preset, setPreset] = useState<Preset>('B');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [region, setRegion] = useState<Region>(() => {
    const saved = localStorage.getItem('relentify-region');
    return (saved as Region) || 'UK';
  });
  const theme = THEMES[preset];

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    localStorage.setItem('relentify-region', region);
  }, [region]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Write shared cookie so login/app subdomains stay consistent
    document.cookie = `relentify_theme=${isDarkMode ? 'dark' : 'light'};domain=.relentify.com;path=/;max-age=31536000;SameSite=Lax`;
  }, [isDarkMode]);

  useEffect(() => {
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

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.palette.primary);
    root.style.setProperty('--theme-accent', theme.palette.accent);
    root.style.setProperty('--theme-background', isDarkMode ? '#0a0a0a' : theme.palette.background);
    root.style.setProperty('--theme-text', isDarkMode ? '#ffffff' : theme.palette.text);
    root.style.setProperty('--theme-dark', theme.palette.dark);
    root.style.setProperty('--theme-card', isDarkMode ? '#1a1a1a' : '#ffffff');
    root.style.setProperty('--theme-border', isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--theme-text-muted', isDarkMode ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)');
    root.style.setProperty('--theme-text-dim', isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)');
    root.style.setProperty('--theme-success', '#10B981');
    root.style.setProperty('--theme-warning', '#F59E0B');
    root.style.setProperty('--theme-destructive', '#EF4444');
  }, [theme, isDarkMode]);

  return (
    <ThemeContext.Provider value={{ preset, setPreset, theme, isDarkMode, toggleDarkMode }}>
      <RegionContext.Provider value={{ region, setRegion }}>
        <Router>
          <ScrollToTop />
          <div
            className={`min-h-screen transition-colors duration-700 ${isDarkMode ? 'dark' : ''}`}
            style={{
              backgroundColor: isDarkMode ? '#0a0a0a' : theme.palette.background,
              color: isDarkMode ? '#ffffff' : theme.palette.text,
            }}
          >
            <div className="noise-overlay" />
            <Navbar />
            <main className="overflow-x-hidden">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/timesheets" element={<Timesheets />} />
                <Route path="/esign" element={<ESign />} />
                <Route path="/websites" element={<Websites />} />
                <Route path="/payroll" element={<Payroll />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/alternatives" element={<AlternativesHub />} />
                <Route path="/xero-alternative" element={<XeroAlternative />} />
                <Route path="/quickbooks-alternative" element={<QuickBooksAlternative />} />
                <Route path="/xero-v-relentify" element={<XeroVsRelentify />} />
                <Route path="/quickbooks-v-relentify" element={<QuickBooksVsRelentify />} />
                <Route path="/privacy" element={<Privacy />} />
              </Routes>
            </main>
            <Footer />
            <ThemeSwitcher />
            <CookieBanner />
          </div>
        </Router>
      </RegionContext.Provider>
    </ThemeContext.Provider>
  );
}
