export type Preset = 'A' | 'B' | 'C' | 'D';

export interface ThemeConfig {
  palette: {
    primary: string;
    accent: string;
    background: string;
    text: string;
    dark: string;
  };
  typography: {
    headings: string;
    drama: string;
    data: string;
  };
  identity: string;
  imageMood: string[];
  heroLinePattern: {
    part1: string;
    part2: string;
  };
}

export const THEMES: Record<Preset, ThemeConfig> = {
  A: {
    identity: "Professional (High-Precision)",
    palette: {
      primary: "#0F172A", // Slate 900
      accent: "#3B82F6",  // Blue 500
      background: "#FFFFFF",
      text: "#0F172A",
      dark: "#0F172A",
    },
    typography: {
      headings: "font-sans font-bold tracking-tight",
      drama: "font-sans font-extrabold",
      data: "font-mono",
    },
    imageMood: ["modern architecture", "clean glass", "professional workspace"],
    heroLinePattern: {
      part1: "The Financial OS for",
      part2: "Modern Business.",
    },
  },
  B: {
    identity: "Modern (Sleek & Minimal)",
    palette: {
      primary: "#000000",
      accent: "#10B981",  // Emerald 500
      background: "#F9FAFB",
      text: "#000000",
      dark: "#000000",
    },
    typography: {
      headings: "font-sans font-bold tracking-tight",
      drama: "font-sans font-medium",
      data: "font-fira",
    },
    imageMood: ["minimalist tech", "sleek devices", "white space"],
    heroLinePattern: {
      part1: "Integrated Suite for",
      part2: "Growth.",
    },
  },
  C: {
    identity: "Utility (Raw & Efficient)",
    palette: {
      primary: "#111827", // Gray 900
      accent: "#EF4444",  // Red 500
      background: "#F3F4F6",
      text: "#111827",
      dark: "#111827",
    },
    typography: {
      headings: "font-space-grotesk font-bold tracking-tighter",
      drama: "font-space-grotesk font-black",
      data: "font-space-mono",
    },
    imageMood: ["industrial design", "raw materials", "precision tools"],
    heroLinePattern: {
      part1: "Simplify the",
      part2: "System.",
    },
  },
  D: {
    identity: "Premium (Dark & Elegant)",
    palette: {
      primary: "#020617", // Slate 950
      accent: "#F59E0B",  // Amber 500
      background: "#020617",
      text: "#F8FAFC",
      dark: "#000000",
    },
    typography: {
      headings: "font-sans font-bold tracking-tight",
      drama: "font-playfair italic",
      data: "font-mono",
    },
    imageMood: ["dark luxury", "gold accents", "nocturnal city"],
    heroLinePattern: {
      part1: "Elegance meets",
      part2: "Precision.",
    },
  },
};
