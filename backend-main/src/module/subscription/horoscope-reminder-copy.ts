import { requireHoroscopeLocale } from './horoscope-localization';
// Non-personalized reminder only. Never put a private reading in an OS notification.
const COPY: Record<string, string> = {
  en: 'Open the app to check your daily horoscope.',
  hi: 'अपना दैनिक राशिफल देखने के लिए ऐप खोलें।',
  bn: 'আপনার দৈনিক রাশিফল দেখতে অ্যাপ খুলুন।',
  ta: 'உங்கள் தினசரி ராசிபலனைப் பார்க்க செயலியைத் திறக்கவும்.',
  te: 'మీ రోజువారీ రాశిఫలాన్ని చూడటానికి యాప్ తెరవండి.',
  mr: 'तुमचे दैनिक राशीभविष्य पाहण्यासाठी ॲप उघडा.',
  gu: 'તમારું દૈનિક રાશિફળ જોવા માટે એપ ખોલો.',
  kn: 'ನಿಮ್ಮ ದೈನಂದಿನ ರಾಶಿಫಲವನ್ನು ನೋಡಲು ಆ್ಯಪ್ ತೆರೆಯಿರಿ.',
  ml: 'നിങ്ങളുടെ ദൈനംദിന രാശിഫലം കാണാൻ ആപ്പ് തുറക്കുക.',
  pa: 'ਆਪਣਾ ਰੋਜ਼ਾਨਾ ਰਾਸ਼ੀਫਲ ਦੇਖਣ ਲਈ ਐਪ ਖੋਲ੍ਹੋ।',
  es: 'Abre la aplicación para consultar tu horóscopo diario.',
  fr: 'Ouvrez l’application pour consulter votre horoscope quotidien.',
  de: 'Öffne die App, um dein Tageshoroskop anzusehen.',
  pt: 'Abra o aplicativo para consultar seu horóscopo diário.',
  it: 'Apri l’app per consultare il tuo oroscopo quotidiano.',
  ja: 'アプリを開いて今日の運勢を確認してください。',
  ko: '앱을 열어 오늘의 운세를 확인하세요.',
  zh: '打开应用查看每日运势。',
  ar: 'افتح التطبيق للاطلاع على برجك اليومي.',
  ru: 'Откройте приложение, чтобы посмотреть ежедневный гороскоп.',
};
export function horoscopeReminderCopy(locale: string) {
  requireHoroscopeLocale(locale);
  return { title: 'Astro Soul Path', body: COPY[locale] };
}
