/// Local fallbacks; existing remotely approved translations take precedence.
const preferenceKeys = [
  'Set Preference',
  'Chart Style',
  'Diamond Chart',
  'Square Chart',
  'Traditional North Indian Vedic layout',
  'Traditional South Indian Vedic layout',
  'Month Type',
  'Amanta',
  'Purnimanta',
  'Lunar month ends at the new moon.',
  'Lunar month ends at the full moon.',
  'Appearance',
  'Light',
  'Dark',
  'System Default',
  'Chart options',
  'Hide Uranus, Neptune and Pluto',
  'Custom Calendar',
  'Reset to Defaults',
  'Save Preferences',
  'Preferences saved.',
  'Try again',
  'Preferences could not be loaded.',
  'Preferences could not be saved.',
];
const preferenceRows = {
  'hi':
      'पसंद सेट करें|कुंडली शैली|हीराकार कुंडली|चौकोर कुंडली|पारंपरिक उत्तर भारतीय वैदिक विन्यास|पारंपरिक दक्षिण भारतीय वैदिक विन्यास|मास पद्धति|अमांत|पूर्णिमांत|चंद्र मास अमावस्या पर समाप्त होता है।|चंद्र मास पूर्णिमा पर समाप्त होता है।|दिखावट|हल्का|गहरा|सिस्टम के अनुसार|कुंडली विकल्प|यूरेनस, नेपच्यून और प्लूटो छिपाएँ|कस्टम कैलेंडर|डिफ़ॉल्ट पर रीसेट करें|पसंद सहेजें|पसंद सहेजी गई।|फिर कोशिश करें|पसंद लोड नहीं हो सकी।|पसंद सहेजी नहीं जा सकी।',
  'bn':
      'পছন্দ নির্ধারণ|ছকের ধরন|হীরকাকৃতি ছক|বর্গাকার ছক|প্রচলিত উত্তর ভারতীয় বৈদিক বিন্যাস|প্রচলিত দক্ষিণ ভারতীয় বৈদিক বিন্যাস|মাসের পদ্ধতি|অমান্ত|পূর্ণিমান্ত|চান্দ্র মাস অমাবস্যায় শেষ হয়।|চান্দ্র মাস পূর্ণিমায় শেষ হয়।|চেহারা|হালকা|গাঢ়|সিস্টেম অনুযায়ী|ছকের বিকল্প|ইউরেনাস, নেপচুন ও প্লুটো লুকান|নিজস্ব ক্যালেন্ডার|ডিফল্টে ফিরুন|পছন্দ সংরক্ষণ|পছন্দ সংরক্ষিত।|আবার চেষ্টা করুন|পছন্দ লোড করা যায়নি।|পছন্দ সংরক্ষণ করা যায়নি।',
  'ta':
      'விருப்பங்களை அமைக்கவும்|கட்ட வடிவம்|வைர வடிவக் கட்டம்|சதுரக் கட்டம்|பாரம்பரிய வட இந்திய வேத அமைப்பு|பாரம்பரிய தென் இந்திய வேத அமைப்பு|மாத முறை|அமாந்தம்|பூர்ணிமாந்தம்|சந்திர மாதம் அமாவாசையில் முடிகிறது.|சந்திர மாதம் பௌர்ணமியில் முடிகிறது.|தோற்றம்|ஒளி|இருள்|சாதன அமைப்பு|கட்ட விருப்பங்கள்|யுரேனஸ், நெப்டியூன், புளூட்டோவை மறைக்கவும்|தனிப்பயன் நாட்காட்டி|இயல்புநிலைக்கு மீட்டமை|விருப்பங்களைச் சேமி|விருப்பங்கள் சேமிக்கப்பட்டன.|மீண்டும் முயற்சி|விருப்பங்களை ஏற்ற முடியவில்லை.|விருப்பங்களைச் சேமிக்க முடியவில்லை。',
  'te':
      'ప్రాధాన్యతలు|చక్ర శైలి|వజ్రాకార చక్రం|చతురస్ర చక్రం|సాంప్రదాయ ఉత్తర భారత వైదిక నమూనా|సాంప్రదాయ దక్షిణ భారత వైదిక నమూనా|మాస పద్ధతి|అమాంతం|పూర్ణిమాంతం|చాంద్రమాసం అమావాస్యతో ముగుస్తుంది.|చాంద్రమాసం పౌర్ణమితో ముగుస్తుంది.|రూపం|లైట్|డార్క్|సిస్టమ్ ప్రకారం|చక్ర ఎంపికలు|యురేనస్, నెప్ట్యూన్, ప్లూటోను దాచు|అనుకూల క్యాలెండర్|డిఫాల్ట్‌లకు రీసెట్|ప్రాధాన్యతలు సేవ్ చేయి|ప్రాధాన్యతలు సేవ్ అయ్యాయి.|మళ్లీ ప్రయత్నించండి|ప్రాధాన్యతలు లోడ్ కాలేదు.|ప్రాధాన్యతలు సేవ్ కాలేదు.',
  'mr':
      'प्राधान्ये ठरवा|कुंडली शैली|हिऱ्याच्या आकाराची कुंडली|चौकोनी कुंडली|पारंपरिक उत्तर भारतीय वैदिक मांडणी|पारंपरिक दक्षिण भारतीय वैदिक मांडणी|मास पद्धत|अमांत|पूर्णिमांत|चांद्रमास अमावास्येला संपतो.|चांद्रमास पौर्णिमेला संपतो.|देखावा|फिकट|गडद|प्रणालीनुसार|कुंडली पर्याय|युरेनस, नेपच्यून आणि प्लूटो लपवा|सानुकूल दिनदर्शिका|मूळ सेटिंग्जवर आणा|प्राधान्ये जतन करा|प्राधान्ये जतन झाली.|पुन्हा प्रयत्न करा|प्राधान्ये लोड झाली नाहीत.|प्राधान्ये जतन झाली नाहीत.',
  'gu':
      'પસંદગીઓ સેટ કરો|કુંડળી શૈલી|હીરાકાર કુંડળી|ચોરસ કુંડળી|પરંપરાગત ઉત્તર ભારતીય વૈદિક ગોઠવણી|પરંપરાગત દક્ષિણ ભારતીય વૈદિક ગોઠવણી|માસ પદ્ધતિ|અમાંત|પૂર્ણિમાંત|ચંદ્ર માસ અમાવસ્યાએ પૂર્ણ થાય છે.|ચંદ્ર માસ પૂર્ણિમાએ પૂર્ણ થાય છે.|દેખાવ|હળવો|ઘેરો|સિસ્ટમ મુજબ|કુંડળી વિકલ્પો|યુરેનસ, નેપ્ચ્યુન અને પ્લુટો છુપાવો|કસ્ટમ કેલેન્ડર|મૂળભૂત પર રીસેટ|પસંદગીઓ સાચવો|પસંદગીઓ સાચવી.|ફરી પ્રયાસ કરો|પસંદગીઓ લોડ થઈ નહીં.|પસંદગીઓ સાચવી શકાઈ નહીં.',
  'kn':
      'ಆದ್ಯತೆಗಳನ್ನು ಹೊಂದಿಸಿ|ಜಾತಕ ಶೈಲಿ|ವಜ್ರಾಕಾರದ ಜಾತಕ|ಚೌಕಾಕಾರದ ಜಾತಕ|ಸಾಂಪ್ರದಾಯಿಕ ಉತ್ತರ ಭಾರತೀಯ ವೈದಿಕ ವಿನ್ಯಾಸ|ಸಾಂಪ್ರದಾಯಿಕ ದಕ್ಷಿಣ ಭಾರತೀಯ ವೈದಿಕ ವಿನ್ಯಾಸ|ಮಾಸ ಪದ್ಧತಿ|ಅಮಾಂತ|ಪೂರ್ಣಿಮಾಂತ|ಚಾಂದ್ರಮಾನ ಮಾಸ ಅಮಾವಾಸ್ಯೆಯಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ.|ಚಾಂದ್ರಮಾನ ಮಾಸ ಹುಣ್ಣಿಮೆಯಲ್ಲಿ ಮುಗಿಯುತ್ತದೆ.|ನೋಟ|ಬೆಳಕು|ಗಾಢ|ವ್ಯವಸ್ಥೆಯ ಪ್ರಕಾರ|ಜಾತಕ ಆಯ್ಕೆಗಳು|ಯುರೇನಸ್, ನೆಪ್ಚೂನ್ ಮತ್ತು ಪ್ಲೂಟೊ ಮರೆಮಾಡಿ|ಕಸ್ಟಮ್ ಕ್ಯಾಲೆಂಡರ್|ಪೂರ್ವನಿಯೋಜಿತಕ್ಕೆ ಮರುಹೊಂದಿಸಿ|ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಿ|ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ.|ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ|ಆದ್ಯತೆಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗಲಿಲ್ಲ.|ಆದ್ಯತೆಗಳನ್ನು ಉಳಿಸಲಾಗಲಿಲ್ಲ.',
  'ml':
      'മുൻഗണനകൾ സജ്ജമാക്കുക|ചാർട്ട് ശൈലി|വജ്രാകൃതിയിലുള്ള ചാർട്ട്|ചതുരാകൃതിയിലുള്ള ചാർട്ട്|പരമ്പരാഗത ഉത്തരേന്ത്യൻ വൈദിക വിന്യാസം|പരമ്പരാഗത ദക്ഷിണേന്ത്യൻ വൈദിക വിന്യാസം|മാസ രീതി|അമാന്തം|പൂർണിമാന്തം|ചാന്ദ്രമാസം അമാവാസിയിൽ അവസാനിക്കുന്നു.|ചാന്ദ്രമാസം പൗർണമിയിൽ അവസാനിക്കുന്നു.|രൂപം|ലൈറ്റ്|ഡാർക്ക്|സിസ്റ്റം അനുസരിച്ച്|ചാർട്ട് ഓപ്ഷനുകൾ|യുറാനസ്, നെപ്റ്റ്യൂൺ, പ്ലൂട്ടോ മറയ്ക്കുക|ഇഷ്ടാനുസൃത കലണ്ടർ|സ്ഥിരസ്ഥിതിയിലേക്ക് മാറ്റുക|മുൻഗണനകൾ സംരക്ഷിക്കുക|മുൻഗണനകൾ സംരക്ഷിച്ചു.|വീണ്ടും ശ്രമിക്കുക|മുൻഗണനകൾ ലോഡ് ചെയ്യാനായില്ല.|മുൻഗണനകൾ സംരക്ഷിക്കാനായില്ല.',
  'pa':
      'ਤਰਜੀਹਾਂ ਸੈੱਟ ਕਰੋ|ਕੁੰਡਲੀ ਸ਼ੈਲੀ|ਹੀਰੇ ਦੇ ਆਕਾਰ ਦੀ ਕੁੰਡਲੀ|ਵਰਗਾਕਾਰ ਕੁੰਡਲੀ|ਰਵਾਇਤੀ ਉੱਤਰੀ ਭਾਰਤੀ ਵੈਦਿਕ ਖਾਕਾ|ਰਵਾਇਤੀ ਦੱਖਣੀ ਭਾਰਤੀ ਵੈਦਿਕ ਖਾਕਾ|ਮਹੀਨੇ ਦੀ ਵਿਧੀ|ਅਮਾਂਤ|ਪੂਰਨਿਮਾਂਤ|ਚੰਦਰ ਮਹੀਨਾ ਮੱਸਿਆ ਨੂੰ ਮੁੱਕਦਾ ਹੈ।|ਚੰਦਰ ਮਹੀਨਾ ਪੂਰਨਮਾਸ਼ੀ ਨੂੰ ਮੁੱਕਦਾ ਹੈ।|ਦਿੱਖ|ਹਲਕਾ|ਗੂੜ੍ਹਾ|ਸਿਸਟਮ ਅਨੁਸਾਰ|ਕੁੰਡਲੀ ਚੋਣਾਂ|ਯੂਰੇਨਸ, ਨੈਪਚੂਨ ਅਤੇ ਪਲੂਟੋ ਲੁਕਾਓ|ਕਸਟਮ ਕੈਲੰਡਰ|ਮੂਲ ਸੈਟਿੰਗਾਂ ਬਹਾਲ ਕਰੋ|ਤਰਜੀਹਾਂ ਸੰਭਾਲੋ|ਤਰਜੀਹਾਂ ਸੰਭਾਲੀਆਂ ਗਈਆਂ।|ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ|ਤਰਜੀਹਾਂ ਲੋਡ ਨਹੀਂ ਹੋਈਆਂ।|ਤਰਜੀਹਾਂ ਸੰਭਾਲੀਆਂ ਨਹੀਂ ਜਾ ਸਕੀਆਂ।',
  'es':
      'Preferencias|Estilo de carta|Carta en diamante|Carta cuadrada|Diseño védico tradicional del norte de India|Diseño védico tradicional del sur de India|Sistema mensual|Amanta|Purnimanta|El mes lunar termina en luna nueva.|El mes lunar termina en luna llena.|Apariencia|Claro|Oscuro|Según el sistema|Opciones de carta|Ocultar Urano, Neptuno y Plutón|Calendario personalizado|Restablecer valores|Guardar preferencias|Preferencias guardadas.|Reintentar|No se pudieron cargar las preferencias.|No se pudieron guardar las preferencias.',
  'fr':
      'Préférences|Style du thème astral|Thème en losange|Thème carré|Disposition védique traditionnelle du nord de l’Inde|Disposition védique traditionnelle du sud de l’Inde|Système mensuel|Amanta|Purnimanta|Le mois lunaire se termine à la nouvelle lune.|Le mois lunaire se termine à la pleine lune.|Apparence|Clair|Sombre|Selon le système|Options du thème|Masquer Uranus, Neptune et Pluton|Calendrier personnalisé|Rétablir les valeurs|Enregistrer les préférences|Préférences enregistrées.|Réessayer|Impossible de charger les préférences.|Impossible d’enregistrer les préférences.',
  'de':
      'Einstellungen|Horoskopstil|Rautenförmiges Horoskop|Quadratisches Horoskop|Traditionelle nordindische vedische Anordnung|Traditionelle südindische vedische Anordnung|Monatssystem|Amanta|Purnimanta|Der Mondmonat endet bei Neumond.|Der Mondmonat endet bei Vollmond.|Darstellung|Hell|Dunkel|Systemstandard|Horoskopoptionen|Uranus, Neptun und Pluto ausblenden|Eigener Kalender|Standard wiederherstellen|Einstellungen speichern|Einstellungen gespeichert.|Erneut versuchen|Einstellungen konnten nicht geladen werden.|Einstellungen konnten nicht gespeichert werden.',
  'pt':
      'Preferências|Estilo do mapa|Mapa em losango|Mapa quadrado|Disposição védica tradicional do norte da Índia|Disposição védica tradicional do sul da Índia|Sistema mensal|Amanta|Purnimanta|O mês lunar termina na lua nova.|O mês lunar termina na lua cheia.|Aparência|Claro|Escuro|Padrão do sistema|Opções do mapa|Ocultar Urano, Netuno e Plutão|Calendário personalizado|Restaurar padrões|Salvar preferências|Preferências salvas.|Tentar novamente|Não foi possível carregar as preferências.|Não foi possível salvar as preferências.',
  'it':
      'Preferenze|Stile della carta|Carta a rombo|Carta quadrata|Disposizione vedica tradizionale dell’India settentrionale|Disposizione vedica tradizionale dell’India meridionale|Sistema mensile|Amanta|Purnimanta|Il mese lunare termina con la luna nuova.|Il mese lunare termina con la luna piena.|Aspetto|Chiaro|Scuro|Predefinito di sistema|Opzioni della carta|Nascondi Urano, Nettuno e Plutone|Calendario personalizzato|Ripristina predefiniti|Salva preferenze|Preferenze salvate.|Riprova|Impossibile caricare le preferenze.|Impossibile salvare le preferenze.',
  'ja':
      '環境設定|チャートの形式|ひし形チャート|正方形チャート|伝統的な北インド式ヴェーダ配置|伝統的な南インド式ヴェーダ配置|月の方式|アマンタ|プールニマンタ|太陰月は新月で終わります。|太陰月は満月で終わります。|外観|ライト|ダーク|システム設定|チャートのオプション|天王星・海王星・冥王星を非表示|カスタムカレンダー|初期設定に戻す|設定を保存|設定を保存しました。|再試行|設定を読み込めませんでした。|設定を保存できませんでした。',
  'ko':
      '환경 설정|차트 형식|마름모 차트|정사각형 차트|전통 북인도 베다 배치|전통 남인도 베다 배치|월 체계|아만타|푸르니만타|음력 월은 새달에 끝납니다.|음력 월은 보름달에 끝납니다.|화면 모드|라이트|다크|시스템 설정|차트 옵션|천왕성, 해왕성, 명왕성 숨기기|맞춤 달력|기본값 복원|설정 저장|설정을 저장했습니다.|다시 시도|설정을 불러올 수 없습니다.|설정을 저장할 수 없습니다.',
  'zh':
      '偏好设置|星盘样式|菱形星盘|方形星盘|传统北印度吠陀布局|传统南印度吠陀布局|月历制度|Amanta|Purnimanta|阴历月在新月时结束。|阴历月在满月时结束。|外观|浅色|深色|跟随系统|星盘选项|隐藏天王星、海王星和冥王星|自定义日历|恢复默认设置|保存偏好|偏好已保存。|重试|无法加载偏好。|无法保存偏好。',
  'ar':
      'التفضيلات|نمط الخريطة|خريطة ماسية|خريطة مربعة|التخطيط الفيدي التقليدي لشمال الهند|التخطيط الفيدي التقليدي لجنوب الهند|نظام الشهر|أمانتا|بورنيمنتا|ينتهي الشهر القمري عند المحاق.|ينتهي الشهر القمري عند البدر.|المظهر|فاتح|داكن|حسب النظام|خيارات الخريطة|إخفاء أورانوس ونبتون وبلوتو|تقويم مخصص|استعادة الافتراضيات|حفظ التفضيلات|تم حفظ التفضيلات.|إعادة المحاولة|تعذر تحميل التفضيلات.|تعذر حفظ التفضيلات.',
  'ru':
      'Настройки|Стиль карты|Ромбовидная карта|Квадратная карта|Традиционная североиндийская ведическая схема|Традиционная южноиндийская ведическая схема|Система месяцев|Аманта|Пурниманта|Лунный месяц заканчивается в новолуние.|Лунный месяц заканчивается в полнолуние.|Оформление|Светлое|Тёмное|Как в системе|Параметры карты|Скрыть Уран, Нептун и Плутон|Свой календарь|Сбросить настройки|Сохранить настройки|Настройки сохранены.|Повторить|Не удалось загрузить настройки.|Не удалось сохранить настройки.',
};
final preferenceTranslations = {
  for (final entry in preferenceRows.entries)
    entry.key: Map<String, String>.fromIterables(
      preferenceKeys,
      entry.value.split('|'),
    ),
};
String? preferenceTranslation(String key, String locale) =>
    preferenceTranslations[locale]?[key];
