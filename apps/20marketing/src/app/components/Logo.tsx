import React from 'react';
import { useTheme } from '../App';

export default function Logo({ className = "w-8 h-8" }: { className?: string }) {
  const { theme } = useTheme();

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Minimalist Tech R */}
      <path
        d="M25 20V80"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="square"
      />
      <path
        d="M45 20V80"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="square"
        className="opacity-40"
      />
      <path
        d="M25 20H65C76.0457 20 85 28.9543 85 40C85 51.0457 76.0457 60 65 60H25"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="square"
      />
      <path
        d="M55 60L85 90"
        stroke={theme.palette.accent}
        strokeWidth="12"
        strokeLinecap="square"
      />
    </svg>
  );
}
