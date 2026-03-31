'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { spring } from '../../animations'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))
    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-[var(--theme-border)]', className)}
        {...props}
      >
        <motion.div
          className="h-full bg-[var(--theme-accent)] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={spring.smooth}
        />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
