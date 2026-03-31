'use client';

import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { spring } from '../../animations';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

const MotionPopoverContent = motion(PopoverPrimitive.Content)

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <MotionPopoverContent
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      initial={{ opacity: 0, scale: 0.97, y: -4 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      transition={spring.snappy}
      className={cn(
        'z-50 w-72 rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 text-[var(--theme-text)] shadow-cinematic outline-none backdrop-blur-3xl',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-100',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = 'PopoverContent';
