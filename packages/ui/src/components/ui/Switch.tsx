'use client'

import * as React from 'react'
import * as SwitchPrimitives from '@radix-ui/react-switch'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { spring } from '../../animations'

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, checked: controlledChecked, defaultChecked = false, onCheckedChange, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked)
  const isChecked = controlledChecked !== undefined ? controlledChecked : internalChecked

  const handleChange = (val: boolean) => {
    if (controlledChecked === undefined) setInternalChecked(val)
    onCheckedChange?.(val)
  }

  return (
    <SwitchPrimitives.Root
      ref={ref}
      checked={isChecked}
      onCheckedChange={handleChange}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-background)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--theme-accent)] data-[state=unchecked]:bg-[var(--theme-border)]',
        className
      )}
      {...props}
    >
      {/* motion.span replaces SwitchPrimitives.Thumb — spring x animation instead of CSS translate */}
      <motion.span
        className="pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0"
        animate={{ x: isChecked ? 20 : 0 }}
        transition={spring.snappy}
      />
    </SwitchPrimitives.Root>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
