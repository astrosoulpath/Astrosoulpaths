import { HoroscopeLocale, requireHoroscopeLocale, validateHoroscopeText } from '../subscription/horoscope-localization';
// Neutral OS reminder, never a chart factor, private interpretation or birth detail.
const COPY: Record<HoroscopeLocale, string> = {
  en: 'Open the app to view your astrology insight.',
  hi: 'अपना ज्योतिष मार्गदर्शन देखने के लिए ऐप खोलें।',
  bn: 'আপনার জ্যোতিষ নির্দেশনা দেখতে অ্যাপ খুলুন।',
  ta: 'உங்கள் ஜோதிட வழிகாட்டுதலைப் பார்க்க செயலியைத் திறக்கவும்.',
  te: 'మీ జ్యోతిష మార్గదర్శకత్వాన్ని చూడటానికి యాప్ తెరవండి.',
  mr: 'तुमचे ज्योतिष मार्गदर्शन पाहण्यासाठी अॅप उघडा.',
  gu: 'તમારું જ્યોતિષ માર્ગદર્શન જોવા માટે એપ ખોલો.',
  kn: 'ನಿಮ್ಮ ಜ್ಯೋತಿಷ ಮಾರ್ಗದರ್ಶನವನ್ನು ನೋಡಲು ಆ್ಯಪ್ ತೆರೆಯಿರಿ.',
  ml: 'നിങ്ങളുടെ ജ്യോതിഷ മാർഗനിർദേശം കാണാൻ ആപ്പ് തുറക്കുക.',
  pa: 'ਆਪਣੀ ਜੋਤਿਸ਼ ਸੇਧ ਦੇਖਣ ਲਈ ਐਪ ਖੋਲ੍ਹੋ।',
  es: 'Abre la aplicación para ver tu orientación astrológica.',
  fr: 'Ouvrez l’application pour consulter votre éclairage astrologique.',
  de: 'Öffne die App, um deine astrologischen Einblicke anzusehen.',
  pt: 'Abra o aplicativo para ver sua orientação astrológica.',
  it: 'Apri l’app per leggere il tuo approfondimento astrologico.',
  ja: 'アプリを開いて占星術のガイダンスをご覧ください。',
  ko: '앱을 열어 점성술 안내를 확인하세요.',
  zh: '打开应用查看您的占星指引。',
  ar: 'افتح التطبيق لعرض إرشاداتك الفلكية.',
  ru: 'Откройте приложение, чтобы прочитать астрологическую рекомендацию.',
};
export function smartReminderCopy(locale: string) {
  const code = requireHoroscopeLocale(locale);
  validateHoroscopeText(code, [COPY[code]]);
  return { title: 'Astro Soul Path', body: COPY[code] };
}
