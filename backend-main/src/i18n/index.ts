import { en } from './en';
import { hi } from './hi';

const languages: any = { en, hi };

export function t(lang: string, path: string): string {
  const selected = languages[lang] || languages['en'];

  const keys = path.split('.');
  let value: any = selected;

  for (const key of keys) {
    value = value?.[key];
  }

  // 🔥 fallback to EN
  if (!value) {
    let fallback: any = languages['en'];

    for (const key of keys) {
      fallback = fallback?.[key];
    }

    return fallback || path;
  }

  return value;
}
