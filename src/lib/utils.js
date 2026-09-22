import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn/ui's class helper: merges conditional class names and lets a later
// Tailwind utility win over an earlier one of the same kind.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
