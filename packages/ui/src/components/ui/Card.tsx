'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { spring } from '../../animations';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'glass' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ 
  children, 
  className, 
  variant = 'default',
  padding = 'md',
  ...props
}, ref) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const variants = {
    default: 'bg-[var(--theme-card)] shadow-cinematic border border-[var(--theme-border)]',
    glass: 'bg-white/70 dark:bg-zinc-900/40 backdrop-blur-3xl border border-white/20 shadow-2xl',
    ghost: 'bg-transparent border-dashed border-[var(--theme-border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
  };

  return (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-3xl",
        variants[variant],
        paddings[padding],
        className
      )}
      whileHover={{ y: -2 }}
      transition={spring.smooth}
      {...props}
    >
      {children}
    </motion.div>
  );
});
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-[var(--theme-text-muted)]', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
