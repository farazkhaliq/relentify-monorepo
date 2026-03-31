"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"
import { spring } from "../../animations"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-200",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

// Spring initial positions per side
const slideInitial: Record<string, object> = {
  top:    { y: '-100%', opacity: 0 },
  bottom: { y:  '100%', opacity: 0 },
  left:   { x: '-100%', opacity: 0 },
  right:  { x:  '100%', opacity: 0 },
}
const slideAnimate = { x: 0, y: 0, opacity: 1 }

const sheetVariants = cva(
  "fixed z-50 gap-4 bg-[var(--theme-background)] p-6 shadow-lg data-[state=closed]:animate-out data-[state=closed]:duration-200",
  {
    variants: {
      side: {
        top:    "inset-x-0 top-0 border-b border-[var(--theme-border)] data-[state=closed]:slide-out-to-top",
        bottom: "inset-x-0 bottom-0 border-t border-[var(--theme-border)] data-[state=closed]:slide-out-to-bottom",
        left:   "inset-y-0 left-0 h-full w-3/4 border-r border-[var(--theme-border)] data-[state=closed]:slide-out-to-left sm:max-w-sm",
        right:  "inset-y-0 right-0 h-full w-3/4 border-l border-[var(--theme-border)] data-[state=closed]:slide-out-to-right sm:max-w-sm",
      },
    },
    defaultVariants: { side: "right" },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const MotionSheetContent = motion(SheetPrimitive.Content)

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <MotionSheetContent
      ref={ref}
      initial={slideInitial[side ?? 'right']}
      animate={slideAnimate}
      transition={spring.smooth}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-[var(--theme-background)] transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)] focus:ring-offset-2 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetClose>
    </MotionSheetContent>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
)
SheetHeader.displayName = "SheetHeader"

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
)
SheetFooter.displayName = "SheetFooter"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-[var(--theme-text)]", className)} {...props} />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-sm text-[var(--theme-text-muted)]", className)} {...props} />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
