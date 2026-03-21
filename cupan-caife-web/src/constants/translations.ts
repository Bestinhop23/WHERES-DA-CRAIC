export type AppLanguage = 'ga' | 'en';

type Copy = {
  tabs: {
    map: string;
    scan: string;
  };
  home: {
    eyebrow: string;
    title: string;
    subtitle: string;
    irishLabel: string;
    irishHint: string;
    englishLabel: string;
    englishHint: string;
    mapPreview: string;
    scanPreview: string;
  };
  map: {
    headerTitle: string;
    headerSubtitle: (count: number) => string;
    nfcReady: string;
    cta: string;
  };
  scan: {
    title: string;
    subtitle: string;
    instructions: string;
    chooseShop: string;
    chooseShopSubtext: string;
    steps: [string, string, string, string];
    selectingTitle: string;
    selectingSubtitle: string;
    readyTitle: string;
    readySubtitle: string;
    scanButton: string;
    simNote: string;
    changeShop: string;
    scanningTitle: string;
    scanningSupported: string;
    scanningDemo: string;
    successTitle: string;
    successSubtitle: string;
    discountNote: string;
    thankYou: string;
    thankYouTranslation: string;
    reset: string;
    errorTitle: string;
    errorSubtitle: string;
    errorMessage: string;
    retry: string;
    back: string;
  };
  shop: {
    notFound: string;
    nfcReady: string;
    aboutTitle: string;
    aboutSubtitle: string;
    howTitle: string;
    howSubtitle: string;
    howSteps: [string, string, string];
    phrasesTitle: string;
    phrasesSubtitle: string;
    scanTitle: string;
    scanSubtitle: string;
    footerText: string;
    footerTranslation: string;
  };
};

export const appCopy: Record<AppLanguage, Copy> = {
  ga: {
    tabs: { map: 'Caif\u00e9', scan: 'Scanadh' },
    home: {
      eyebrow: 'Cupan Caife',
      title: 'Roghnaigh do theanga',
      subtitle: 'Tosaigh i nGaeilge n\u00f3 i mB\u00e9arla, ansin aimsigh caife agus scan do lascaine.',
      irishLabel: 'Gaeilge',
      irishHint: 'Taithi iomlan tr\u00ed Ghaeilge',
      englishLabel: 'B\u00e9arla',
      englishHint: 'Bain \u00fas\u00e1id as an aip i mB\u00e9arla',
      mapPreview: 'L\u00e9arsc\u00e1il de shiopa\u00ed caife in aice leat',
      scanPreview: 'Scan NFC chun 20% de lacaine a fh\u00e1il',
    },
    map: {
      headerTitle: 'L\u00e9arsc\u00e1il Caife',
      headerSubtitle: (count) => `${count} siopa i mBaile Atha Cliath`,
      nfcReady: 'NFC r\u00e9idh',
      cta: 'Ordaigh as Gaeilge',
    },
    scan: {
      title: 'Scan do Lascaine',
      subtitle: 'Faigh 20% de lacaine',
      instructions: 'Ordaigh do chaife as Gaeilge, ansin scan an chlib NFC ag an gcuntar chun do lascaine a \u00e9ileamh.',
      chooseShop: 'Roghnaigh Siopa',
      chooseShopSubtext: 'Pioc do chaif\u00e9',
      steps: ['Roghnaigh do shiopa caife', 'Ordaigh i nGaeilge ag an gcuntar', 'Scan an chlib NFC', 'Bain taitneamh as 20% de lacaine'],
      selectingTitle: 'Roghnaigh Siopa',
      selectingSubtitle: 'Roghnaigh siopa caife in aice leat',
      readyTitle: 'R\u00e9idh le scanadh!',
      readySubtitle: 'T\u00e1 gach rud ullamh',
      scanButton: 'Scan an chlib NFC',
      simNote: 'M\u00f3d taispe\u00e1na \u2014 NFC insamhlaithe.',
      changeShop: 'Athraigh siopa',
      scanningTitle: 'Ag scanadh...',
      scanningSupported: 'Coinnigh do ghuth\u00e1n gar don chlib NFC',
      scanningDemo: 'Scanadh NFC insamhlaithe...',
      successTitle: 'Go hiontach!',
      successSubtitle: 'Ta do lascaine reidh',
      discountNote: 'Taispe\u00e1in \u00e9 seo do do bharista',
      thankYou: 'Go raibh maith agat as Gaeilge a labhairt!',
      thankYouTranslation: 'Thank you for speaking Irish!',
      reset: 'D\u00e9an ar\u00eds',
      errorTitle: 'N\u00edor oibrigh s\u00e9 sin',
      errorSubtitle: 'Bain triail eile as',
      errorMessage: 'D\u00e9an cinnte go bhfuil do ghuth\u00e1n gar don chlib NFC ag an gcuntar.',
      retry: 'Bain triail eile as',
      back: 'Ar ais',
    },
    shop: {
      notFound: 'N\u00edor aims\u00edodh an siopa',
      nfcReady: 'NFC r\u00e9idh',
      aboutTitle: 'Faoin Siopa',
      aboutSubtitle: 'Eolas tapa',
      howTitle: 'Conas a oibrionn s\u00e9',
      howSubtitle: 'Na c\u00e9imeanna',
      howSteps: ['Ordaigh do chaife i nGaeilge ag an gcuntar', 'Scan an chlib NFC le do ghuth\u00e1n', 'Faigh 20% de lacaine ar d\'ord\u00fa'],
      phrasesTitle: 'Frasa\u00ed \u00fas\u00e1ideacha',
      phrasesSubtitle: 'Abairt\u00ed chun ord\u00fa a dh\u00e9anamh',
      scanTitle: 'Scan do Lascaine',
      scanSubtitle: 'T\u00e9igh go dt\u00ed an scaile\u00e1n scanadh',
      footerText: 'Mol an \u00f3ige agus tiocfaidh s\u00ed',
      footerTranslation: 'Praise the young and they will flourish',
    },
  },
  en: {
    tabs: { map: 'Coffee', scan: 'Scan' },
    home: {
      eyebrow: 'Cupan Caife',
      title: 'Choose your language',
      subtitle: 'Start in Irish or English, then find a cafe and scan for your discount.',
      irishLabel: 'Irish',
      irishHint: 'Use the app fully in Irish',
      englishLabel: 'English',
      englishHint: 'Use the app fully in English',
      mapPreview: 'Map nearby coffee spots',
      scanPreview: 'Scan NFC to unlock 20% off',
    },
    map: {
      headerTitle: 'Coffee Map',
      headerSubtitle: (count) => `${count} cafes in Dublin`,
      nfcReady: 'NFC Ready',
      cta: 'Order in Irish',
    },
    scan: {
      title: 'Scan for Your Discount',
      subtitle: 'Unlock 20% off',
      instructions: 'Order your coffee as Gaeilge, then scan the NFC tag at the counter to claim your discount.',
      chooseShop: 'Choose a Shop',
      chooseShopSubtext: 'Pick your cafe',
      steps: ['Choose your coffee shop', 'Order in Irish at the counter', 'Scan the NFC tag', 'Enjoy 20% off'],
      selectingTitle: 'Choose a Shop',
      selectingSubtitle: 'Select a nearby coffee shop',
      readyTitle: 'Ready to Scan!',
      readySubtitle: 'Everything is set',
      scanButton: 'Scan NFC Tag',
      simNote: 'Demo mode \u2014 NFC is simulated.',
      changeShop: 'Change shop',
      scanningTitle: 'Scanning...',
      scanningSupported: 'Hold your phone near the NFC tag',
      scanningDemo: 'Simulating NFC scan...',
      successTitle: 'Success!',
      successSubtitle: 'Your discount is ready',
      discountNote: 'Show this to your barista',
      thankYou: 'Go raibh maith agat as Gaeilge a labhairt!',
      thankYouTranslation: 'Thank you for speaking Irish!',
      reset: 'Do it again',
      errorTitle: 'That did not work',
      errorSubtitle: 'Try again',
      errorMessage: 'Make sure your phone is close to the NFC tag at the counter.',
      retry: 'Try again',
      back: 'Back',
    },
    shop: {
      notFound: 'Shop not found',
      nfcReady: 'NFC Ready',
      aboutTitle: 'About the Shop',
      aboutSubtitle: 'Quick overview',
      howTitle: 'How It Works',
      howSubtitle: 'Three quick steps',
      howSteps: ['Order your coffee in Irish at the counter', 'Scan the NFC tag with your phone', 'Get 20% off your order'],
      phrasesTitle: 'Useful Phrases',
      phrasesSubtitle: 'Helpful order phrases',
      scanTitle: 'Scan for Your Discount',
      scanSubtitle: 'Open the scanning screen',
      footerText: 'Mol an oige agus tiocfaidh si',
      footerTranslation: 'Praise the young and they will flourish',
    },
  },
};
