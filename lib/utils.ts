import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export { parseAllowedDomains } from "@/schemas/jobs"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

