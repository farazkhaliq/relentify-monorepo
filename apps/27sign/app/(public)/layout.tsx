import { ThemeProvider, NoiseOverlay } from '@relentify/ui'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider initialPreset="D">
      <NoiseOverlay />
      {children}
    </ThemeProvider>
  )
}
