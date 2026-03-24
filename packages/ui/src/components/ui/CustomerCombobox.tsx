'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './Command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './Popover';

interface Customer {
  id: string;
  name: string;
  email?: string;
}

interface CustomerComboboxProps {
  customers: Customer[];
  value: string;
  onValueChange: (customerId: string) => void;
  onCreateNew?: () => void;
}

export function CustomerCombobox({ customers, value, onValueChange, onCreateNew }: CustomerComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selectedCustomer = customers.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-[var(--theme-card)] border border-[var(--theme-border)] hover:bg-[var(--theme-accent)]/5 h-12 px-6 rounded-full text-[var(--theme-text)] shadow-sm"
        >
          <span className="truncate">{selectedCustomer ? selectedCustomer.name : 'Select customer...'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 border-[var(--theme-border)] bg-[var(--theme-card)] shadow-cinematic backdrop-blur-3xl rounded-3xl overflow-hidden">
        <Command>
          <CommandInput placeholder="Search customers..." className="border-none" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name}
                  onSelect={() => {
                    onValueChange(customer.id === value ? '' : customer.id);
                    setOpen(false);
                  }}
                  className="rounded-2xl mx-1"
                >
                  <Check className={cn('mr-2 h-4 w-4', value === customer.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col truncate">
                    <span className="font-medium text-sm">{customer.name}</span>
                    {customer.email && <span className="text-[10px] opacity-50">{customer.email}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreateNew && (
              <div className="border-t border-[var(--theme-border)] p-2 mt-1">
                <button
                  type="button"
                  onClick={() => { setOpen(false); onCreateNew(); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/10 rounded-2xl transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create new customer</span>
                </button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
