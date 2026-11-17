/**
 * Tiny dependency-free i18n. English is the source of truth; any key missing in
 * another language falls back to English. Translations were written by an AI
 * assistant and MUST be reviewed by native speakers before field use. The app
 * also offers AI translation on demand for any other language (see src/ai).
 */
export interface Lang {
  code: string;
  name: string;
  /** BCP-47 tag for speech synthesis */
  speech: string;
  dir?: 'rtl';
}

export const LANGS: Lang[] = [
  { code: 'en', name: 'English', speech: 'en-IN' },
  { code: 'hi', name: 'हिन्दी', speech: 'hi-IN' },
  { code: 'bn', name: 'বাংলা', speech: 'bn-IN' },
  { code: 'ta', name: 'தமிழ்', speech: 'ta-IN' },
  { code: 'es', name: 'Español', speech: 'es-ES' },
  { code: 'sw', name: 'Kiswahili', speech: 'sw-KE' },
];

type Dict = Record<string, string>;

const en: Dict = {
  appName: 'Stock & Foil',
  tagline: 'A tamper-proof work record that both sides hold.',
  stockTitle: 'STOCK · worker keeps',
  foilTitle: 'FOIL · employer keeps',
  keepStock: 'Worker keeps this half. Bring it on payday.',
  keepFoil: 'Employer keeps this half. Punch both together each day.',
  perDay: 'day',
  cardCode: 'Card',
  advanceRow: 'Advances taken (each = {v})',
  carryRow: 'Balance brought forward: {v}',
  pairedBadge: 'Paired card',
  pairCaption: 'the QR holds a code that must match the other half',
  writeWorker: 'Worker',
  writeEmployer: 'Employer',
  tokenWorth: 'advance token {v}',
  cutHere: 'cut along the wavy line',
  printNote: 'Print at 100% on A4, cut on the wave, punch holes through both halves together.',
  // nav
  navHome: 'Home',
  navIssue: 'New card',
  navPunch: 'Punch',
  navScan: 'Payday scan',
  navLab: 'Test lab',
  navLedger: 'Ledger',
  navAbout: 'Story',
  // slip
  slipTitle: 'Pay slip',
  slipDays: 'days worked',
  slipRate: 'per day',
  slipGross: 'earned',
  slipAdvances: 'advances taken',
  slipTotal: 'TO PAY',
  slipOwed: 'worker owes (carry forward)',
  slipDisputed: 'In dispute',
  slipAgreedNote: 'Counted only days punched on BOTH halves.',
  slipCarry: 'balance brought forward',
  slipWageChange: 'new wage from day {n} (agreed at payday)',
  slipSpeak: 'Read aloud',
  // verdicts
  vGenuine: 'Genuine pair. Both records agree.',
  vDisputed: 'Genuine pair, but the records disagree.',
  vMismatch: 'These halves do NOT belong together.',
  vInconclusive: 'Pair looks fine but the cut edge was not clear.',
  vReview: 'Records agree, but some holes look separately made. Check those days.',
  vUnreliable: 'Photo not reliable. Retake both photos before paying.',
  // scan
  scanTitle: 'Payday scan',
  scanHelp: 'Photograph each half on a dark table. Keep all four corner squares and the wavy edge in view.',
  scanStock: 'Worker half (stock)',
  scanFoil: 'Employer half (foil)',
  scanCamera: 'Use camera',
  scanUpload: 'Choose photo',
  scanBoth: 'Both halves in one photo',
  scanRun: 'Check the pair',
  scanning: 'Reading…',
};

const hi: Dict = {
  tagline: 'छेड़छाड़-रोधी काम का रिकॉर्ड, जो दोनों पक्षों के पास रहता है।',
  stockTitle: 'स्टॉक · मज़दूर के पास',
  foilTitle: 'फ़ॉइल · मालिक के पास',
  keepStock: 'यह हिस्सा मज़दूर रखे। पगार के दिन साथ लाए।',
  keepFoil: 'यह हिस्सा मालिक रखे। रोज़ दोनों हिस्से साथ रखकर छेद करें।',
  perDay: 'दिन',
  cardCode: 'कार्ड',
  advanceRow: 'लिए गए एडवांस (हर एक = {v})',
  cutHere: 'लहरदार रेखा पर काटें',
  navHome: 'होम', navIssue: 'नया कार्ड', navPunch: 'छेद', navScan: 'पगार जाँच', navLab: 'टेस्ट लैब', navLedger: 'बही', navAbout: 'कहानी',
  slipTitle: 'पगार पर्ची',
  slipDays: 'दिन काम किया',
  slipRate: 'प्रति दिन',
  slipGross: 'कमाई',
  slipAdvances: 'एडवांस लिया',
  slipCarry: 'पिछला बकाया',
  slipWageChange: 'दिन {n} से नई मज़दूरी (पगार के दिन तय)',
  carryRow: 'पिछला बकाया: {v}',
  pairedBadge: 'जोड़ीदार कार्ड',
  pairCaption: 'QR में ऐसा कोड है जो दूसरे हिस्से से मिलना चाहिए',
  writeWorker: 'मज़दूर',
  writeEmployer: 'मालिक',
  tokenWorth: 'एडवांस टोकन {v}',
  slipTotal: 'देय रकम',
  slipOwed: 'मज़दूर पर बकाया (आगे जोड़ें)',
  slipDisputed: 'विवाद में',
  slipAgreedNote: 'सिर्फ़ वही दिन गिने गए जो दोनों हिस्सों पर छेदे हैं।',
  slipSpeak: 'सुनें',
  vGenuine: 'असली जोड़ी। दोनों रिकॉर्ड मेल खाते हैं।',
  vDisputed: 'असली जोड़ी, पर रिकॉर्ड में फ़र्क है।',
  vMismatch: 'ये दोनों हिस्से एक-दूसरे के नहीं हैं।',
  scanTitle: 'पगार जाँच',
  scanStock: 'मज़दूर का हिस्सा (स्टॉक)',
  scanFoil: 'मालिक का हिस्सा (फ़ॉइल)',
  scanCamera: 'कैमरा खोलें',
  scanUpload: 'फ़ोटो चुनें',
  scanRun: 'जोड़ी जाँचें',
};

const bn: Dict = {
  tagline: 'জালিয়াতি-প্রতিরোধী কাজের হিসাব, যা দুই পক্ষের কাছেই থাকে।',
  stockTitle: 'স্টক · শ্রমিকের কাছে',
  foilTitle: 'ফয়েল · মালিকের কাছে',
  perDay: 'দিন',
  slipTitle: 'বেতনের স্লিপ',
  slipDays: 'দিন কাজ',
  slipRate: 'প্রতি দিন',
  slipGross: 'আয়',
  slipAdvances: 'অগ্রিম নেওয়া',
  slipTotal: 'দিতে হবে',
  slipSpeak: 'শুনুন',
  vGenuine: 'আসল জোড়া। দুটি হিসাব মিলেছে।',
  vDisputed: 'আসল জোড়া, কিন্তু হিসাবে গরমিল।',
  vMismatch: 'এই দুই অংশ একসঙ্গে মেলে না।',
  scanTitle: 'বেতনের দিনের স্ক্যান',
};

const ta: Dict = {
  tagline: 'இரு தரப்பிடமும் இருக்கும், மாற்ற முடியாத வேலைப் பதிவு.',
  stockTitle: 'ஸ்டாக் · தொழிலாளியிடம்',
  foilTitle: 'ஃபாயில் · முதலாளியிடம்',
  perDay: 'நாள்',
  slipTitle: 'சம்பளச் சீட்டு',
  slipDays: 'நாட்கள் வேலை',
  slipRate: 'ஒரு நாளுக்கு',
  slipGross: 'சம்பாத்தியம்',
  slipAdvances: 'முன்பணம்',
  slipTotal: 'கொடுக்க வேண்டியது',
  slipSpeak: 'கேளுங்கள்',
  vGenuine: 'உண்மையான இணை. இரு பதிவுகளும் ஒத்துப்போகின்றன.',
  vDisputed: 'உண்மையான இணை, ஆனால் பதிவுகள் வேறுபடுகின்றன.',
  vMismatch: 'இந்த இரு பாதிகளும் ஒன்றுக்கொன்று உரியவை அல்ல.',
  scanTitle: 'சம்பள நாள் சோதனை',
};

const es: Dict = {
  tagline: 'Un registro de trabajo a prueba de manipulaciones que ambas partes conservan.',
  stockTitle: 'MATRIZ · la guarda el trabajador',
  foilTitle: 'TALÓN · lo guarda el empleador',
  keepStock: 'El trabajador guarda esta mitad. Debe traerla el día de pago.',
  keepFoil: 'El empleador guarda esta mitad. Perforen ambas juntas cada día.',
  perDay: 'día',
  cardCode: 'Tarjeta',
  advanceRow: 'Adelantos recibidos (cada uno = {v})',
  cutHere: 'cortar por la línea ondulada',
  navHome: 'Inicio', navIssue: 'Nueva tarjeta', navPunch: 'Perforar', navScan: 'Escaneo de pago', navLab: 'Laboratorio', navLedger: 'Libro', navAbout: 'Historia',
  slipTitle: 'Recibo de pago',
  slipDays: 'días trabajados',
  slipRate: 'por día',
  slipGross: 'ganado',
  slipAdvances: 'adelantos recibidos',
  slipCarry: 'saldo del mes anterior',
  slipWageChange: 'nuevo salario desde el día {n} (acordado el día de pago)',
  carryRow: 'Saldo del mes anterior: {v}',
  pairedBadge: 'Tarjeta emparejada',
  pairCaption: 'el QR guarda un código que debe coincidir con la otra mitad',
  writeWorker: 'Trabajador',
  writeEmployer: 'Empleador',
  tokenWorth: 'adelanto {v}',
  slipTotal: 'A PAGAR',
  slipOwed: 'el trabajador debe (pasa al mes siguiente)',
  slipDisputed: 'En disputa',
  slipAgreedNote: 'Solo se cuentan los días perforados en AMBAS mitades.',
  slipSpeak: 'Leer en voz alta',
  vGenuine: 'Pareja auténtica. Ambos registros coinciden.',
  vDisputed: 'Pareja auténtica, pero los registros no coinciden.',
  vMismatch: 'Estas mitades NO pertenecen juntas.',
  scanTitle: 'Escaneo de pago',
  scanStock: 'Mitad del trabajador (matriz)',
  scanFoil: 'Mitad del empleador (talón)',
  scanCamera: 'Usar cámara',
  scanUpload: 'Elegir foto',
  scanRun: 'Revisar la pareja',
  scanning: 'Leyendo…',
};

const sw: Dict = {
  tagline: 'Rekodi ya kazi isiyoweza kughushiwa, inayoshikwa na pande zote mbili.',
  stockTitle: 'STOKI · mfanyakazi anashika',
  foilTitle: 'FOILI · mwajiri anashika',
  perDay: 'siku',
  slipTitle: 'Karatasi ya malipo',
  slipDays: 'siku za kazi',
  slipRate: 'kwa siku',
  slipGross: 'alizopata',
  slipAdvances: 'malipo ya awali',
  slipTotal: 'KULIPWA',
  slipSpeak: 'Soma kwa sauti',
  vGenuine: 'Jozi halisi. Rekodi zote mbili zinakubaliana.',
  vDisputed: 'Jozi halisi, lakini rekodi zinatofautiana.',
  vMismatch: 'Nusu hizi HAZIHUSIANI.',
  scanTitle: 'Ukaguzi wa siku ya malipo',
};

const DICTS: Record<string, Dict> = { en, hi, bn, ta, es, sw };

/** Extra runtime translations (e.g. AI-generated) layered on top. */
const runtime: Record<string, Dict> = {};

export function addRuntimeTranslations(lang: string, d: Dict) {
  runtime[lang] = { ...(runtime[lang] ?? {}), ...d };
}

export function t(lang: string, key: string, vars: Record<string, string | number> = {}): string {
  const raw = runtime[lang]?.[key] ?? DICTS[lang]?.[key] ?? en[key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function englishDict(): Dict {
  return en;
}

export function langInfo(code: string): Lang {
  return LANGS.find((l) => l.code === code) ?? LANGS[0];
}

function intlLocale(lang: string) {
  return langInfo(lang).speech;
}

export function monthName(lang: string, month: number): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(lang), { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, month - 1, 1)));
  } catch {
    return String(month);
  }
}

/** Monday-first short weekday names. */
export function weekdayShort(lang: string, i: number): string {
  try {
    return new Intl.DateTimeFormat(intlLocale(lang), { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i)));
  } catch {
    return ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i];
  }
}
