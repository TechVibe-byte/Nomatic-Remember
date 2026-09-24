import { CategoryInfo } from '../types.ts';

export const CATEGORIES: CategoryInfo[] = [
  { id: 'work', name: 'Work', color: 'indigo', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: 'emerald', icon: 'User' },
  { id: 'health', name: 'Health', color: 'rose', icon: 'Heart' },
  { id: 'finance', name: 'Finance', color: 'amber', icon: 'DollarSign' },
  { id: 'urgent', name: 'Urgent', color: 'red', icon: 'Flame' },
  { id: 'study', name: 'Study', color: 'sky', icon: 'BookOpen' },
  { id: 'focus', name: 'Focus', color: 'violet', icon: 'Target' },
];

export function getCategoryMeta(categoryId: string): CategoryInfo {
  const found = CATEGORIES.find(c => c.id.toLowerCase() === categoryId.toLowerCase());
  if (found) return found;
  return { id: categoryId, name: categoryId.charAt(0).toUpperCase() + categoryId.slice(1), color: 'slate', icon: 'Tag' };
}

export function getCategoryBadgeClasses(color: string): { dot: string; text: string } {
  switch (color) {
    case 'indigo':
      return { dot: 'bg-indigo-500', text: 'text-indigo-400 dark:text-indigo-300' };
    case 'emerald':
      return { dot: 'bg-emerald-500', text: 'text-emerald-400 dark:text-emerald-300' };
    case 'rose':
      return { dot: 'bg-rose-500', text: 'text-rose-400 dark:text-rose-300' };
    case 'amber':
      return { dot: 'bg-amber-500', text: 'text-amber-400 dark:text-amber-300' };
    case 'red':
      return { dot: 'bg-red-500', text: 'text-red-400 dark:text-red-300' };
    case 'sky':
      return { dot: 'bg-sky-500', text: 'text-sky-400 dark:text-sky-300' };
    case 'violet':
      return { dot: 'bg-violet-500', text: 'text-violet-400 dark:text-violet-300' };
    default:
      return { dot: 'bg-slate-400', text: 'text-slate-400 dark:text-slate-300' };
  }
}
