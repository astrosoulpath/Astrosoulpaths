require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const translations = [
  ['en', 'Finding Balance Through Your Moon Sign', 'A gentle global guide to understanding your emotional rhythm.', 'Your Moon sign describes the emotional patterns that help you feel safe, understood and restored. Notice what brings calm to your daily routine, then make space for it with patience and kindness.'],
  ['hi', 'अपनी चंद्र राशि के माध्यम से संतुलन पाएं', 'अपने भावनात्मक स्वभाव को समझने के लिए एक सरल मार्गदर्शिका।', 'आपकी चंद्र राशि उन भावनात्मक जरूरतों को दर्शाती है जो आपको सुरक्षित, समझा हुआ और शांत महसूस कराती हैं। जो चीज़ें आपके दिन में सुकून लाती हैं, उन्हें धैर्य और प्रेम के साथ जगह दें।'],
  ['bn', 'আপনার চন্দ্র রাশির মাধ্যমে ভারসাম্য খুঁজুন', 'আপনার আবেগের ছন্দ বোঝার জন্য একটি কোমল নির্দেশিকা।', 'আপনার চন্দ্র রাশি সেই আবেগগত চাহিদাগুলি প্রকাশ করে যা আপনাকে নিরাপদ ও শান্ত অনুভব করায়। যা আপনাকে প্রতিদিন স্বস্তি দেয়, তা ধৈর্য ও যত্নের সঙ্গে জীবনে জায়গা দিন।'],
  ['ta', 'உங்கள் சந்திர ராசி மூலம் சமநிலையை கண்டறியுங்கள்', 'உங்கள் உணர்ச்சி ரிதத்தை புரிந்துகொள்ள ஒரு மென்மையான வழிகாட்டி.', 'உங்கள் சந்திர ராசி உங்களை பாதுகாப்பாகவும் அமைதியாகவும் உணர வைக்கும் உணர்ச்சி தேவைகளை கூறுகிறது. தினசரி உங்களுக்கு நிம்மதி தருவதை கவனித்து, அதற்கு அன்புடன் இடம் கொடுங்கள்.'],
  ['te', 'మీ చంద్ర రాశి ద్వారా సమతుల్యతను కనుగొనండి', 'మీ భావోద్వేగ స్వభావాన్ని అర్థం చేసుకునేందుకు ఒక సున్నితమైన మార్గదర్శకం.', 'మీ చంద్ర రాశి మిమ్మల్ని సురక్షితంగా మరియు ప్రశాంతంగా భావింపజేసే భావోద్వేగ అవసరాలను తెలియజేస్తుంది. మీ దినచర్యలో శాంతిని ఇచ్చే వాటికి ఓర్పుతో స్థానం ఇవ్వండి.'],
  ['mr', 'तुमच्या चंद्रराशीद्वारे संतुलन शोधा', 'तुमच्या भावनिक लयीला समजून घेण्यासाठी एक सौम्य मार्गदर्शक.', 'तुमची चंद्रराशी तुम्हाला सुरक्षित, समजून घेतलेले आणि शांत वाटण्यासाठी आवश्यक भावनिक गरजा दर्शवते. जे तुम्हाला रोज शांतता देते त्यासाठी प्रेमाने वेळ आणि जागा ठेवा.'],
  ['gu', 'તમારી ચંદ્ર રાશિ દ્વારા સંતુલન શોધો', 'તમારી ભાવનાત્મક લય સમજવા માટે એક સરળ માર્ગદર્શિકા.', 'તમારી ચંદ્ર રાશિ તમને સુરક્ષિત અને શાંત અનુભવ કરાવતી ભાવનાત્મક જરૂરિયાતો દર્શાવે છે. જે વસ્તુઓ રોજ તમને શાંતિ આપે છે, તેને ધીરજ અને પ્રેમથી જીવનમાં સ્થાન આપો.'],
  ['kn', 'ನಿಮ್ಮ ಚಂದ್ರ ರಾಶಿಯ ಮೂಲಕ ಸಮತೋಲನ ಕಂಡುಕೊಳ್ಳಿ', 'ನಿಮ್ಮ ಭಾವನಾತ್ಮಕ ಲಯವನ್ನು ಅರ್ಥಮಾಡಿಕೊಳ್ಳಲು ಮೃದು ಮಾರ್ಗದರ್ಶಿ.', 'ನಿಮ್ಮ ಚಂದ್ರ ರಾಶಿ ನಿಮಗೆ ಸುರಕ್ಷತೆ ಮತ್ತು ನೆಮ್ಮದಿ ನೀಡುವ ಭಾವನಾತ್ಮಕ ಅಗತ್ಯಗಳನ್ನು ತಿಳಿಸುತ್ತದೆ. ನಿಮ್ಮ ದಿನಚರಿಯಲ್ಲಿ ಶಾಂತಿ ತರುವ ಸಂಗತಿಗಳಿಗೆ ಪ್ರೀತಿಯಿಂದ ಸ್ಥಳ ನೀಡಿ.'],
  ['ml', 'നിങ്ങളുടെ ചന്ദ്രരാശിയിലൂടെ സമതുലിതാവസ്ഥ കണ്ടെത്തുക', 'നിങ്ങളുടെ വൈകാരിക താളം മനസ്സിലാക്കാനുള്ള സൗമ്യമായ മാർഗദർശി.', 'നിങ്ങളുടെ ചന്ദ്രരാശി സുരക്ഷിതവും ശാന്തവുമാകാൻ സഹായിക്കുന്ന വൈകാരിക ആവശ്യങ്ങളെ സൂചിപ്പിക്കുന്നു. ദിവസേന മനസ്സിന് ആശ്വാസം നൽകുന്ന കാര്യങ്ങൾക്ക് കരുതലോടെ ഇടം നൽകുക.'],
  ['pa', 'ਆਪਣੀ ਚੰਦਰ ਰਾਸ਼ੀ ਰਾਹੀਂ ਸੰਤੁਲਨ ਲੱਭੋ', 'ਆਪਣੀ ਭਾਵਨਾਤਮਕ ਲੈ ਨੂੰ ਸਮਝਣ ਲਈ ਇੱਕ ਕੋਮਲ ਮਾਰਗਦਰਸ਼ਕ।', 'ਤੁਹਾਡੀ ਚੰਦਰ ਰਾਸ਼ੀ ਉਹ ਭਾਵਨਾਤਮਕ ਲੋੜਾਂ ਦੱਸਦੀ ਹੈ ਜੋ ਤੁਹਾਨੂੰ ਸੁਰੱਖਿਅਤ ਅਤੇ ਸ਼ਾਂਤ ਮਹਿਸੂਸ ਕਰਾਉਂਦੀਆਂ ਹਨ। ਜੋ ਚੀਜ਼ਾਂ ਹਰ ਰੋਜ਼ ਸਕੂਨ ਦਿੰਦੀਆਂ ਹਨ, ਉਨ੍ਹਾਂ ਲਈ ਪਿਆਰ ਨਾਲ ਜਗ੍ਹਾ ਬਣਾਓ।'],
  ['es', 'Encuentra el equilibrio a través de tu signo lunar', 'Una guía suave para comprender tu ritmo emocional.', 'Tu signo lunar describe las necesidades emocionales que te ayudan a sentirte seguro, comprendido y en calma. Observa qué aporta serenidad a tu día y hazle espacio con paciencia y cariño.'],
  ['fr', 'Trouver votre équilibre grâce à votre signe lunaire', 'Un guide doux pour mieux comprendre votre rythme émotionnel.', 'Votre signe lunaire décrit les besoins émotionnels qui vous aident à vous sentir en sécurité et en harmonie. Observez ce qui apaise votre quotidien et accordez-lui une place avec patience.'],
  ['de', 'Balance durch dein Mondzeichen finden', 'Ein sanfter Leitfaden für deinen emotionalen Rhythmus.', 'Dein Mondzeichen zeigt die emotionalen Bedürfnisse, die dir Sicherheit und Ruhe geben. Achte darauf, was deinen Alltag beruhigt, und gib diesen Dingen mit Geduld und Freundlichkeit Raum.'],
  ['pt', 'Encontre equilíbrio através do seu signo lunar', 'Um guia suave para compreender o seu ritmo emocional.', 'O seu signo lunar descreve as necessidades emocionais que ajudam você a se sentir seguro e em paz. Observe o que traz calma ao seu dia e dê espaço a isso com paciência e carinho.'],
  ['it', 'Trova equilibrio attraverso il tuo segno lunare', 'Una guida delicata per comprendere il tuo ritmo emotivo.', 'Il tuo segno lunare descrive i bisogni emotivi che ti aiutano a sentirti al sicuro e sereno. Nota ciò che porta calma alla tua giornata e fai spazio a queste cose con pazienza.'],
  ['ja', '月星座を通して心のバランスを見つける', '感情のリズムを理解するためのやさしいガイド。', '月星座は、安心感や落ち着きを得るために必要な感情的な要素を表します。毎日に穏やかさをもたらすものに気づき、思いやりを持って時間を与えましょう。'],
  ['ko', '달 별자리를 통해 균형 찾기', '감정의 리듬을 이해하기 위한 부드러운 안내서입니다.', '달 별자리는 안전함과 평온함을 느끼게 하는 감정적 필요를 보여 줍니다. 일상에 편안함을 주는 것이 무엇인지 살피고, 인내와 다정함으로 그 자리를 지켜 주세요.'],
  ['zh', '通过月亮星座寻找内在平衡', '帮助你理解情绪节奏的温和指南。', '月亮星座反映了让你感到安全、被理解和安宁的情感需求。留意每天带给你平静的事物，并以耐心和善意为它们留出空间。'],
  ['ar', 'اعثر على التوازن من خلال برجك القمري', 'دليل لطيف لفهم إيقاعك العاطفي.', 'يصف برجك القمري الاحتياجات العاطفية التي تساعدك على الشعور بالأمان والهدوء. انتبه لما يمنح يومك طمأنينة، وامنحه مساحة بصبر ولطف.'],
  ['ru', 'Как обрести баланс через свой лунный знак', 'Мягкий путеводитель по вашему эмоциональному ритму.', 'Ваш лунный знак отражает эмоциональные потребности, которые помогают чувствовать спокойствие и внутреннюю опору. Замечайте, что возвращает вам равновесие, и бережно включайте это в повседневную жизнь.'],
].map(([locale, title, excerpt, contentMarkdown]) => ({
  locale,
  title,
  excerpt,
  contentMarkdown,
  authorName: 'Astro Soul Path Editorial',
  readingMinutes: 3,
}));

async function run() {
  const article = await prisma.astrologyArticle.update({
    where: { slug: 'finding-balance-through-your-moon-sign' },
    data: {
      isPublished: true,
      isFeatured: true,
      publishedAt: new Date(),
      translations: {
        deleteMany: {},
        create: translations,
      },
    },
    include: { translations: { orderBy: { locale: 'asc' } } },
  });

  console.log({
    updated: true,
    translationCount: article.translations.length,
    locales: article.translations.map((item) => item.locale),
  });
}

run()
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(() => prisma.$disconnect());
