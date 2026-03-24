"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./Button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "w-full",
        month_caption: "flex items-center justify-center h-9 mb-3",
        caption_label: "text-xs font-black uppercase tracking-widest text-[var(--theme-text)]",
        nav: "absolute inset-x-0 top-0 flex w-full items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 opacity-40 hover:opacity-100 hover:bg-[var(--theme-border)] rounded-full transition-all"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 opacity-40 hover:opacity-100 hover:bg-[var(--theme-border)] rounded-full transition-all"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex mb-1",
        weekday: "text-[var(--theme-text-dim)] w-10 font-bold text-[0.6rem] uppercase tracking-widest text-center",
        week: "flex w-full mt-1",
        day: "h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-10 p-0 font-medium aria-selected:opacity-100 rounded-full transition-all"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-[var(--theme-accent)] text-white hover:bg-[var(--theme-accent)] hover:text-white focus:bg-[var(--theme-accent)] focus:text-white rounded-full shadow-sm",
        today: "ring-1 ring-[var(--theme-accent)] text-[var(--theme-accent)] font-bold rounded-full",
        outside:
          "day-outside text-[var(--theme-text-dim)] opacity-40 aria-selected:bg-[var(--theme-accent)]/50 aria-selected:text-white",
        disabled: "text-[var(--theme-text-dim)] opacity-30",
        range_middle:
          "aria-selected:bg-[var(--theme-accent)]/15 aria-selected:text-[var(--theme-text)] rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-3.5 w-3.5" {...rest} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" {...rest} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
