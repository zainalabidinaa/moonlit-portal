export type TvLang = 'en' | 'sv' | 'ar' | 'es' | 'fr' | 'de';

export interface TvInstallText {
  name: string;
  rtl?: boolean;
  title: string;
  languageLabel: string;
  easiest: string;
  /** Steps use {short} for the short link and {activate} for the sign-in page; **bold** marks UI labels. */
  steps: string[];
  adbHeading: string;
  warning: string;
  verify: string;
  checksum: string;
}

export const TV_LANGS: TvLang[] = ['en', 'sv', 'ar', 'es', 'fr', 'de'];

export const TV_INSTALL_TEXT: Record<TvLang, TvInstallText> = {
  en: {
    name: 'English',
    title: 'Installing on Android TV',
    languageLabel: 'Language',
    easiest: 'Easiest way: the Downloader app',
    steps: [
      'On your TV, install **Downloader** (by AFTVnews) from the Play Store or Amazon Appstore.',
      'Open Settings, Security, and allow **Install unknown apps** for Downloader. On Fire TV it is under My Fire TV, Developer options.',
      'Open Downloader and type {short}',
      'Press Go, wait for the download, then choose **Install** and **Open**.',
      'Axis shows a code. Go to {activate} on your phone or computer to sign in.',
    ],
    adbHeading: 'Or from your computer (adb)',
    warning: 'Android may warn that the app comes from outside the Play Store. That is expected for a direct download.',
    verify: 'To check your download, compare its SHA-256 checksum with',
    checksum: 'the published one',
  },
  sv: {
    name: 'Svenska',
    title: 'Installera på Android TV',
    languageLabel: 'Språk',
    easiest: 'Enklast: appen Downloader',
    steps: [
      'Installera **Downloader** (från AFTVnews) på din TV via Play Store eller Amazon Appstore.',
      'Öppna Inställningar, Säkerhet, och tillåt **Installera okända appar** för Downloader. På Fire TV finns det under My Fire TV, Utvecklaralternativ.',
      'Öppna Downloader och skriv {short}',
      'Tryck på Go, vänta tills nedladdningen är klar och välj sedan **Installera** och **Öppna**.',
      'Axis visar en kod. Gå till {activate} på mobilen eller datorn för att logga in.',
    ],
    adbHeading: 'Eller från datorn (adb)',
    warning: 'Android kan varna för att appen kommer utanför Play Store. Det är normalt vid direktnedladdning.',
    verify: 'Kontrollera din nedladdning genom att jämföra SHA-256-kontrollsumman med',
    checksum: 'den publicerade',
  },
  ar: {
    name: 'العربية',
    rtl: true,
    title: 'التثبيت على Android TV',
    languageLabel: 'اللغة',
    easiest: 'أسهل طريقة: تطبيق Downloader',
    steps: [
      'على التلفاز، ثبّت تطبيق **Downloader** (من AFTVnews) من متجر Play أو Amazon Appstore.',
      'افتح الإعدادات ثم الأمان، وفعّل **تثبيت التطبيقات غير المعروفة** لتطبيق Downloader. في Fire TV تجدها ضمن My Fire TV ثم خيارات المطوّر.',
      'افتح Downloader واكتب {short}',
      'اضغط Go وانتظر انتهاء التنزيل، ثم اختر **تثبيت** ثم **فتح**.',
      'يعرض Axis رمزًا. افتح {activate} على هاتفك أو حاسوبك لتسجيل الدخول.',
    ],
    adbHeading: 'أو من حاسوبك (adb)',
    warning: 'قد يحذّرك أندرويد من أن التطبيق من خارج متجر Play. هذا طبيعي عند التنزيل المباشر.',
    verify: 'للتحقق من الملف الذي نزّلته، قارن بصمة SHA-256 الخاصة به مع',
    checksum: 'البصمة المنشورة',
  },
  es: {
    name: 'Español',
    title: 'Instalar en Android TV',
    languageLabel: 'Idioma',
    easiest: 'La forma más fácil: la app Downloader',
    steps: [
      'En tu TV, instala **Downloader** (de AFTVnews) desde Play Store o Amazon Appstore.',
      'Abre Ajustes, Seguridad, y permite **Instalar apps desconocidas** para Downloader. En Fire TV está en My Fire TV, Opciones de desarrollador.',
      'Abre Downloader y escribe {short}',
      'Pulsa Go, espera la descarga y elige **Instalar** y **Abrir**.',
      'Axis muestra un código. Entra en {activate} desde tu móvil u ordenador para iniciar sesión.',
    ],
    adbHeading: 'O desde tu ordenador (adb)',
    warning: 'Android puede avisar de que la app viene de fuera de Play Store. Es normal en una descarga directa.',
    verify: 'Para comprobar tu descarga, compara su suma SHA-256 con',
    checksum: 'la publicada',
  },
  fr: {
    name: 'Français',
    title: 'Installer sur Android TV',
    languageLabel: 'Langue',
    easiest: 'Le plus simple : l’app Downloader',
    steps: [
      'Sur votre TV, installez **Downloader** (par AFTVnews) depuis le Play Store ou l’Amazon Appstore.',
      'Ouvrez Paramètres, Sécurité, et autorisez **Installer des applis inconnues** pour Downloader. Sur Fire TV : My Fire TV, Options pour les développeurs.',
      'Ouvrez Downloader et saisissez {short}',
      'Appuyez sur Go, attendez le téléchargement, puis choisissez **Installer** et **Ouvrir**.',
      'Axis affiche un code. Rendez-vous sur {activate} depuis votre téléphone ou ordinateur pour vous connecter.',
    ],
    adbHeading: 'Ou depuis votre ordinateur (adb)',
    warning: 'Android peut signaler que l’app vient de hors du Play Store. C’est normal pour un téléchargement direct.',
    verify: 'Pour vérifier votre téléchargement, comparez sa somme SHA-256 avec',
    checksum: 'celle publiée',
  },
  de: {
    name: 'Deutsch',
    title: 'Auf Android TV installieren',
    languageLabel: 'Sprache',
    easiest: 'Am einfachsten: die Downloader-App',
    steps: [
      'Installiere auf deinem TV **Downloader** (von AFTVnews) aus dem Play Store oder Amazon Appstore.',
      'Öffne Einstellungen, Sicherheit, und erlaube **Unbekannte Apps installieren** für Downloader. Bei Fire TV: My Fire TV, Entwickleroptionen.',
      'Öffne Downloader und gib {short} ein',
      'Tippe auf Go, warte auf den Download und wähle **Installieren** und **Öffnen**.',
      'Axis zeigt einen Code. Melde dich über {activate} auf Handy oder Computer an.',
    ],
    adbHeading: 'Oder vom Computer aus (adb)',
    warning: 'Android warnt eventuell, dass die App nicht aus dem Play Store stammt. Bei einem direkten Download ist das normal.',
    verify: 'Prüfe deinen Download, indem du seine SHA-256-Prüfsumme vergleichst mit',
    checksum: 'der veröffentlichten',
  },
};
