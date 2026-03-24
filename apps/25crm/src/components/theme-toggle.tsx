'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme, Button } from '@relentify/ui'

export function ThemeToggle() {
  const { isDarkMode, toggleDarkMode } = useTheme()

  return (
    <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
      {isDarkMode ? (
        <Sun className="h-[1.2rem] w-[1.2rem]" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem]" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
