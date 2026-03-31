'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { spring, variants } from '../../animations';

const buttonVariants = cva(
  'magnetic-btn inline-flex items-center justify-center whitespace-nowrap rounded-full disabled:pointer-events-none disabled:opacity-50 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        primary:     'bg-[var(--theme-accent)] text-white hover:opacity-90',
        secondary:   'bg-[var(--theme-primary)] text-white hover:opacity-90',
        ghost:       'bg-transparent hover:bg-black/5 dark:hover:bg-white/5',
        outline:     'bg-transparent border border-[var(--theme-accent)] text-[var(--theme-accent)] hover:bg-[var(--theme-accent)] hover:text-white',
        destructive: 'bg-[var(--theme-destructive)] text-white hover:opacity-90',
        link:        'text-[var(--theme-accent)] underline-offset-4 hover:underline',
        default:     'bg-[var(--theme-accent)] text-white hover:opacity-90',
      },
      size: {
        sm:      'px-3 py-1.5 text-sm',
        md:      'px-6 py-3 text-base',
        lg:      'px-8 py-4 text-lg font-bold',
        default: 'px-6 py-3 text-base',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size:    'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const MotionButton = motion.button;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    // asChild uses Slot (not motion) — skip animation for render-as-child pattern
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <MotionButton
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        initial="rest"
        whileHover="hovered"
        whileTap="pressed"
        variants={variants.interactive}
        transition={spring.snappy}
        {...props}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {children}
          </span>
        ) : children}
      </MotionButton>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
