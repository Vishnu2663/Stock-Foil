/**
 * Story mode in several languages: the nine chapters (title, short label, text) and the
 * sentences the live scanner verdicts are read out in. English is the source; the others
 * were drafted by an AI assistant and MUST be reviewed by native speakers before field use.
 */
export interface StoryPack {
  code: string;
  /** the language's own name, shown in the picker */
  name: string;
  /** BCP-47 tag used to pick a speech-synthesis voice */
  speech: string;
  rtl?: boolean;
  title: string[];
  short: string[];
  text: string[];
  /** {n} = agreed days, {days} = the disputed day number(s) */
  v: { mismatchPairing: string; mismatch: string; disputed: string; sloppy: string; ok: string };
}

const en: StoryPack = {
  code: 'en', name: 'English', speech: 'en-IN',
  title: ['1834 · The fire', 'Why a stick? It was split.', 'It comes back from the dead', 'The claim', 'The sneaky hole', 'A sloppy cut? No problem.', 'The forgery that fits perfectly', 'Paid once. Only once.', 'Back from the dead'],
  short: ['The fire', 'The split', 'Resurrection', 'The claim', 'Extra hole', 'Sloppy cut', 'The forgery', 'Paid', 'The end'],
  text: [
    'For seven hundred years England kept its accounts on notched hazel sticks. In October 1834 the old sticks were fed to the furnaces beneath the House of Lords. The chimneys caught fire, and the Houses of Parliament burned down.',
    'A tally was split lengthwise. The creditor kept the stock, the debtor kept the foil. To cheat you had to match a grain nobody can see. The two halves were the proof.',
    'Today millions of workers are still paid by the day, in cash, with nothing in writing. Stock and Foil resurrects the tally: a card cut in two along a wavy line. The worker keeps one half, the employer the other, and every evening both are punched together.',
    'Contractor: you only worked four days. Ramesh has no phone, no payslip, no witness. But his half has five holes, and the scanner confirms the pair is genuine: both halves carry matching secret codes.',
    'Someone punches a sixth hole into one half only. The other half never got it. The scanner compares both halves and shows the hole that exists on one side alone. It is never paid.',
    'Hand cutting is never perfect. Here the foil was cut along a completely different line, so the wavy edges do not fit. Old paper tallies would have been rejected. But the QR codes carry a pairing secret, so the pair is still proven genuine.',
    'Now someone prints a fake foil using everything on the worker’s half: the name, the numbers, even the same cut. The edges fit perfectly. But the secret in the QR cannot be copied from one half to invent the other, so the forgery fails, and burns.',
    'At payday the agreed days become a pay slip, the money is recorded in a tamper-evident ledger, and the card cannot be paid twice. A balance owed carries forward to next month, locked into the next card.',
    'The tally sticks that burned Parliament have come back from the dead. Paper is the security. Both sides hold the same record, and nobody has to trust an app, a server, or each other.',
  ],
  v: {
    mismatchPairing: '⛔ The pairing codes do not fit. The cut matched perfectly, but the secret could not be copied.',
    mismatch: '⛔ These halves do NOT belong together.',
    disputed: '⚠ Genuine pair, but day {days} is on one half only. Agreed: {n} days.',
    sloppy: '✅ Genuine pair, even though the cut edges do not fit: the pairing code proves it. {n} days agree.',
    ok: '✅ Genuine pair, pairing code verified. {n} days agree on both halves.',
  },
};

const hi: StoryPack = {
  code: 'hi', name: 'हिन्दी', speech: 'hi-IN',
  title: ['1834 · आग', 'लकड़ी क्यों? उसे बाँटा जाता था।', 'वह मौत से लौट आई', 'दावा', 'चालाक छेद', 'कटाई ठीक नहीं? कोई बात नहीं।', 'जालसाज़ी जो हूबहू फिट बैठती है', 'एक बार भुगतान, सिर्फ़ एक बार', 'मौत से वापसी'],
  short: ['आग', 'बँटवारा', 'पुनर्जन्म', 'दावा', 'अतिरिक्त छेद', 'टेढ़ी कटाई', 'जालसाज़ी', 'भुगतान', 'अंत'],
  text: [
    'सात सौ साल तक इंग्लैंड अपना हिसाब हेज़ल की खाँचेदार लकड़ियों पर रखता रहा। अक्टूबर 1834 में पुरानी लकड़ियाँ हाउस ऑफ़ लॉर्ड्स के नीचे भट्टियों में झोंक दी गईं। चिमनियों में आग लग गई और संसद भवन जलकर राख हो गया।',
    'टैली को लंबाई में बाँटा जाता था। लेनदार स्टॉक रखता था और देनदार फ़ॉइल। धोखा देने के लिए ऐसी बनावट मिलानी पड़ती जो किसी को दिखती नहीं। दोनों हिस्से ही सबूत थे।',
    'आज भी करोड़ों मज़दूरों को रोज़ की दिहाड़ी नकद मिलती है, लिखित कुछ नहीं। स्टॉक एंड फ़ॉइल टैली को फिर ज़िंदा करता है: एक कार्ड, जो लहरदार रेखा पर दो हिस्सों में कटा है। मज़दूर एक हिस्सा रखता है, मालिक दूसरा, और हर शाम दोनों को साथ में छेदा जाता है।',
    'ठेकेदार: तुमने सिर्फ़ चार दिन काम किया। रमेश के पास न फ़ोन है, न पर्ची, न गवाह। पर उसके हिस्से में पाँच छेद हैं, और स्कैनर पुष्टि करता है कि जोड़ी असली है: दोनों हिस्सों में मेल खाते गुप्त कोड हैं।',
    'कोई सिर्फ़ एक हिस्से में छठा छेद कर देता है। दूसरे हिस्से में वह कभी नहीं हुआ। स्कैनर दोनों हिस्सों की तुलना करता है और वह छेद दिखाता है जो सिर्फ़ एक तरफ़ है। उसका भुगतान कभी नहीं होता।',
    'हाथ से काटना कभी सटीक नहीं होता। यहाँ फ़ॉइल बिल्कुल अलग रेखा पर कटा है, इसलिए लहरदार किनारे नहीं मिलते। पुरानी काग़ज़ी टैली इसे ठुकरा देती। पर QR कोड में जोड़ी का गुप्त कोड है, इसलिए जोड़ी फिर भी असली साबित होती है।',
    'अब कोई नकली फ़ॉइल छापता है, मज़दूर के हिस्से की हर चीज़ के साथ: नाम, संख्याएँ, यहाँ तक कि वही कटाई। किनारे हूबहू फिट बैठते हैं। पर QR का गुप्त कोड एक हिस्से से नक़ल करके दूसरा हिस्सा नहीं बनाया जा सकता, इसलिए जालसाज़ी नाकाम होती है, और जल जाती है।',
    'पगार के दिन तय दिन पगार पर्ची बन जाते हैं, पैसा छेड़छाड़-रोधी बही में दर्ज होता है, और कार्ड का भुगतान दो बार नहीं हो सकता। बकाया रकम अगले महीने के कार्ड में जुड़ जाती है, और वहीं बंद हो जाती है।',
    'जिन टैली लकड़ियों ने संसद जलाई थी, वे मौत से लौट आई हैं। काग़ज़ ही सुरक्षा है। दोनों पक्षों के पास एक ही रिकॉर्ड है, और किसी को ऐप, सर्वर या एक-दूसरे पर भरोसा नहीं करना पड़ता।',
  ],
  v: {
    mismatchPairing: '⛔ जोड़ी के कोड मेल नहीं खाते। कटाई हूबहू थी, पर गुप्त कोड नक़ल नहीं हो सका।',
    mismatch: '⛔ ये दोनों हिस्से एक-दूसरे के नहीं हैं।',
    disputed: '⚠ असली जोड़ी, पर दिन {days} सिर्फ़ एक हिस्से पर है। तय: {n} दिन।',
    sloppy: '✅ असली जोड़ी, भले ही किनारे नहीं मिलते: जोड़ी का कोड इसे साबित करता है। {n} दिन मेल खाते हैं।',
    ok: '✅ असली जोड़ी, जोड़ी का कोड सही। दोनों हिस्सों पर {n} दिन मेल खाते हैं।',
  },
};

const bn: StoryPack = {
  code: 'bn', name: 'বাংলা', speech: 'bn-IN',
  title: ['১৮৩৪ · আগুন', 'কেন একটি কাঠি? তাকে ভাগ করা হতো।', 'মৃত্যু থেকে ফিরে এসেছে', 'দাবি', 'চালাকি করা ছিদ্র', 'কাটা ঠিক নেই? সমস্যা নেই।', 'নিখুঁতভাবে মিলে যাওয়া জালিয়াতি', 'একবারই পরিশোধ', 'মৃত্যু থেকে ফেরা'],
  short: ['আগুন', 'ভাগ', 'পুনর্জন্ম', 'দাবি', 'বাড়তি ছিদ্র', 'এলোমেলো কাটা', 'জালিয়াতি', 'পরিশোধ', 'শেষ'],
  text: [
    'সাতশো বছর ধরে ইংল্যান্ড তার হিসাব রাখত খাঁজকাটা হ্যাজেল কাঠিতে। ১৮৩৪ সালের অক্টোবরে পুরোনো কাঠিগুলো হাউস অফ লর্ডসের নিচের চুল্লিতে ফেলে দেওয়া হলো। চিমনিতে আগুন ধরে গেল, আর পার্লামেন্ট ভবন পুড়ে ছাই হলো।',
    'একটি ট্যালিকে লম্বালম্বি ভাগ করা হতো। পাওনাদার রাখত স্টক, দেনাদার রাখত ফয়েল। ঠকাতে হলে এমন দানা মেলাতে হতো যা কেউ দেখতে পায় না। দুই অংশই ছিল প্রমাণ।',
    'আজও কোটি কোটি শ্রমিক দিন হিসাবে নগদ মজুরি পান, লিখিত কিছু নেই। স্টক অ্যান্ড ফয়েল ট্যালিকে আবার বাঁচিয়ে তোলে: একটি কার্ড ঢেউখেলানো রেখায় দুই টুকরো করা। শ্রমিক এক অংশ রাখেন, মালিক অন্যটি, আর প্রতি সন্ধ্যায় দুটোকে একসঙ্গে ছিদ্র করা হয়।',
    'ঠিকাদার: তুমি মাত্র চার দিন কাজ করেছ। রমেশের ফোন নেই, বেতনের কাগজ নেই, সাক্ষী নেই। কিন্তু তার অংশে পাঁচটি ছিদ্র আছে, আর স্ক্যানার নিশ্চিত করে জোড়াটি আসল: দুই অংশেই মিলে যাওয়া গোপন কোড আছে।',
    'কেউ শুধু একটি অংশে ষষ্ঠ ছিদ্র করে। অন্য অংশে তা কখনও হয়নি। স্ক্যানার দুই অংশ তুলনা করে এবং যে ছিদ্র একদিকেই আছে তা দেখায়। তার জন্য কখনও মজুরি দেওয়া হয় না।',
    'হাতে কাটা কখনও নিখুঁত হয় না। এখানে ফয়েল সম্পূর্ণ অন্য রেখায় কাটা, তাই ঢেউয়ের কিনারা মেলে না। পুরোনো কাগুজে ট্যালি হলে বাতিল হতো। কিন্তু QR কোডে জোড়ার গোপন কোড আছে, তাই জোড়া তবুও আসল প্রমাণিত।',
    'এবার কেউ শ্রমিকের অংশের সবকিছু দিয়ে একটি নকল ফয়েল ছাপে: নাম, সংখ্যা, এমনকি একই কাটা। কিনারা নিখুঁতভাবে মেলে। কিন্তু QR-এর গোপন কোড এক অংশ থেকে নকল করে অন্যটি বানানো যায় না, তাই জালিয়াতি ব্যর্থ হয়, আর পুড়ে যায়।',
    'মজুরির দিনে সম্মত দিনগুলো বেতনের স্লিপ হয়ে যায়, টাকা রদবদল-প্রতিরোধী খাতায় লেখা হয়, আর কার্ডের দাম দুবার দেওয়া যায় না। বাকি টাকা পরের মাসে জমা হয়, পরের কার্ডে আটকে।',
    'যে ট্যালি কাঠি পার্লামেন্ট পুড়িয়েছিল তারা মৃত্যু থেকে ফিরে এসেছে। কাগজই নিরাপত্তা। দুই পক্ষের কাছেই একই রেকর্ড, আর কাউকে অ্যাপ, সার্ভার বা একে অপরকে বিশ্বাস করতে হয় না।',
  ],
  v: {
    mismatchPairing: '⛔ জোড়ার কোড মেলে না। কাটা নিখুঁত মিলেছিল, কিন্তু গোপন কোড নকল করা যায়নি।',
    mismatch: '⛔ এই দুই অংশ একসঙ্গে নয়।',
    disputed: '⚠ আসল জোড়া, কিন্তু {days} দিন শুধু এক অংশে আছে। সম্মত: {n} দিন।',
    sloppy: '✅ আসল জোড়া, কিনারা না মিললেও: জোড়ার কোড তা প্রমাণ করে। {n} দিন মিলেছে।',
    ok: '✅ আসল জোড়া, জোড়ার কোড যাচাই হয়েছে। দুই অংশেই {n} দিন মিলেছে।',
  },
};

const ta: StoryPack = {
  code: 'ta', name: 'தமிழ்', speech: 'ta-IN',
  title: ['1834 · தீ', 'ஏன் ஒரு கோல்? அது பிளக்கப்பட்டது.', 'மரணத்திலிருந்து திரும்பி வந்தது', 'குற்றச்சாட்டு', 'தந்திரமான துளை', 'வெட்டு சரியில்லையா? பரவாயில்லை.', 'நேர்த்தியாகப் பொருந்தும் போலி', 'ஒரு முறை மட்டுமே செலுத்தப்படும்', 'மரணத்திலிருந்து திரும்பியது'],
  short: ['தீ', 'பிளவு', 'மறுபிறப்பு', 'குற்றச்சாட்டு', 'கூடுதல் துளை', 'சரியற்ற வெட்டு', 'போலி', 'செலுத்தப்பட்டது', 'முடிவு'],
  text: [
    'எழுநூறு ஆண்டுகள் இங்கிலாந்து தன் கணக்குகளை குறிகள் வெட்டிய ஹேசல் கோல்களில் வைத்திருந்தது. 1834 அக்டோபரில் பழைய கோல்கள் ஹவுஸ் ஆஃப் லார்ட்ஸின் கீழிருந்த உலைகளில் போடப்பட்டன. புகைபோக்கிகள் தீப்பிடித்தன, நாடாளுமன்றம் எரிந்து சாம்பலானது.',
    'ஒரு கணக்குக்கோல் நீளவாக்கில் பிளக்கப்பட்டது. கடன் கொடுத்தவர் ஸ்டாக்கையும், கடன் வாங்கியவர் ஃபாயிலையும் வைத்திருந்தனர். ஏமாற்ற யாருக்கும் தெரியாத இழையை ஒப்பிட வேண்டும். இரு பாதிகளுமே சான்று.',
    'இன்றும் கோடிக்கணக்கான தொழிலாளர்களுக்கு நாள் கூலி பணமாகவே, எழுத்தில் எதுவும் இல்லாமல் கிடைக்கிறது. ஸ்டாக் & ஃபாயில் அந்தக் கோலை மீண்டும் உயிர்ப்பிக்கிறது: அலைக்கோட்டில் இரண்டாக வெட்டிய ஒரு அட்டை. தொழிலாளி ஒரு பாதியையும், முதலாளி மற்றொன்றையும் வைத்திருக்கிறார்கள்; ஒவ்வொரு மாலையும் இரண்டும் சேர்த்துத் துளையிடப்படும்.',
    'ஒப்பந்ததாரர்: நீ நான்கு நாள் மட்டுமே வேலை செய்தாய். ரமேஷிடம் தொலைபேசி இல்லை, சம்பளச் சீட்டு இல்லை, சாட்சி இல்லை. ஆனால் அவன் பாதியில் ஐந்து துளைகள் உள்ளன; இந்த ஜோடி உண்மையானது என்று ஸ்கேனர் உறுதிப்படுத்துகிறது: இரு பாதிகளிலும் பொருந்தும் ரகசியக் குறியீடுகள் உள்ளன.',
    'யாரோ ஒரு பாதியில் மட்டும் ஆறாவது துளையிடுகிறார். மற்றதில் அது இல்லை. ஸ்கேனர் இரண்டையும் ஒப்பிட்டு ஒரு பக்கம் மட்டும் உள்ள துளையைக் காட்டுகிறது. அதற்குக் கூலி தரப்படுவதில்லை.',
    'கையால் வெட்டுவது ஒருபோதும் துல்லியமாக இருக்காது. இங்கே ஃபாயில் முற்றிலும் வேறு கோட்டில் வெட்டப்பட்டதால் அலை விளிம்புகள் பொருந்தவில்லை. பழைய காகிதக் கணக்குக்கோல்கள் இதை நிராகரித்திருக்கும். ஆனால் QR குறியீடுகளில் இணைப்பு ரகசியம் உள்ளதால், ஜோடி இன்னும் உண்மையானது என நிரூபணமாகிறது.',
    'இப்போது யாரோ தொழிலாளியின் பாதியில் உள்ள எல்லாவற்றையும் வைத்து போலி ஃபாயில் அச்சிடுகிறார்: பெயர், எண்கள், அதே வெட்டு கூட. விளிம்புகள் நேர்த்தியாகப் பொருந்துகின்றன. ஆனால் QR-இல் உள்ள ரகசியத்தை ஒரு பாதியிலிருந்து நகலெடுத்து மற்றதை உருவாக்க முடியாது; எனவே போலி தோல்வியடைகிறது, எரிந்து போகிறது.',
    'சம்பள நாளில் ஒப்புக்கொண்ட நாட்கள் சம்பளச் சீட்டாகின்றன; பணம் மாற்ற முடியாத பேரேட்டில் பதியப்படுகிறது; அட்டைக்கு இரண்டு முறை பணம் தர முடியாது. நிலுவை அடுத்த மாதத்துக்குத் தொடர்கிறது, அடுத்த அட்டையில் பூட்டப்பட்டு.',
    'நாடாளுமன்றத்தை எரித்த கணக்குக்கோல்கள் மரணத்திலிருந்து திரும்பி வந்துவிட்டன. காகிதமே பாதுகாப்பு. இரு தரப்பிடமும் ஒரே பதிவு; செயலியையோ, சேவையகத்தையோ, ஒருவரையொருவரோ நம்ப வேண்டியதில்லை.',
  ],
  v: {
    mismatchPairing: '⛔ ஜோடிக் குறியீடுகள் பொருந்தவில்லை. வெட்டு நேர்த்தியாகப் பொருந்தியது, ஆனால் ரகசியத்தை நகலெடுக்க முடியவில்லை.',
    mismatch: '⛔ இந்த இரு பாதிகளும் ஒன்றுக்கொன்று உரியவை அல்ல.',
    disputed: '⚠ உண்மையான ஜோடி, ஆனால் நாள் {days} ஒரு பாதியில் மட்டுமே உள்ளது. ஒப்புக்கொண்டது: {n} நாட்கள்.',
    sloppy: '✅ உண்மையான ஜோடி, விளிம்புகள் பொருந்தாவிட்டாலும்: ஜோடிக் குறியீடு அதை நிரூபிக்கிறது. {n} நாட்கள் பொருந்துகின்றன.',
    ok: '✅ உண்மையான ஜோடி, ஜோடிக் குறியீடு சரிபார்க்கப்பட்டது. இரு பாதிகளிலும் {n} நாட்கள் பொருந்துகின்றன.',
  },
};

const te: StoryPack = {
  code: 'te', name: 'తెలుగు', speech: 'te-IN',
  title: ['1834 · అగ్ని', 'ఎందుకు కర్ర? దాన్ని చీల్చేవారు.', 'మరణం నుంచి తిరిగి వచ్చింది', 'ఆరోపణ', 'తెలివైన రంధ్రం', 'కోత సరిగా లేదా? ఫర్వాలేదు.', 'సరిగ్గా సరిపోయే నకిలీ', 'ఒక్కసారే చెల్లింపు', 'మరణం నుంచి తిరిగి రావడం'],
  short: ['అగ్ని', 'చీలిక', 'పునర్జన్మ', 'ఆరోపణ', 'అదనపు రంధ్రం', 'సరికాని కోత', 'నకిలీ', 'చెల్లింపు', 'ముగింపు'],
  text: [
    'ఏడు వందల సంవత్సరాలు ఇంగ్లాండ్ తన లెక్కలను గుర్తులు కోసిన హేజెల్ కర్రలపై ఉంచింది. 1834 అక్టోబర్‌లో పాత కర్రలను హౌస్ ఆఫ్ లార్డ్స్ కింద ఉన్న కొలిమిల్లో వేశారు. పొగగొట్టాలు మంటలు అంటుకున్నాయి, పార్లమెంట్ భవనం కాలి బూడిదైంది.',
    'లెక్క కర్రను పొడవుగా చీల్చేవారు. అప్పు ఇచ్చినవారు స్టాక్ ఉంచుకునేవారు, తీసుకున్నవారు ఫాయిల్. మోసం చేయాలంటే ఎవరికీ కనిపించని నారలను సరిపోల్చాలి. రెండు సగాలే సాక్ష్యం.',
    'ఈ రోజు కూడా కోట్లాది కార్మికులకు రోజు కూలీ నగదుగా, ఏమీ రాతపూర్వకంగా లేకుండా ఇస్తున్నారు. స్టాక్ అండ్ ఫాయిల్ ఆ కర్రను తిరిగి బతికిస్తుంది: తరంగ రేఖ వెంట రెండుగా కోసిన కార్డు. కార్మికుడు ఒక సగం, యజమాని మరొకటి ఉంచుకుంటారు, ప్రతి సాయంత్రం రెండింటినీ కలిపి రంధ్రం చేస్తారు.',
    'కాంట్రాక్టర్: నువ్వు నాలుగు రోజులే పని చేశావు. రమేష్‌కు ఫోన్ లేదు, జీతం చీటీ లేదు, సాక్షి లేదు. కానీ అతని సగంలో ఐదు రంధ్రాలున్నాయి, జంట నిజమైనదని స్కానర్ నిర్ధారిస్తుంది: రెండు సగాల్లోనూ సరిపోయే రహస్య కోడ్‌లు ఉన్నాయి.',
    'ఎవరో ఒక సగంలో మాత్రమే ఆరో రంధ్రం చేస్తారు. రెండో సగానికి అది ఎప్పుడూ రాలేదు. స్కానర్ రెండు సగాలను పోల్చి ఒక వైపు మాత్రమే ఉన్న రంధ్రాన్ని చూపిస్తుంది. దానికి ఎప్పుడూ చెల్లింపు ఉండదు.',
    'చేత్తో కోయడం ఎప్పుడూ ఖచ్చితంగా ఉండదు. ఇక్కడ ఫాయిల్ పూర్తిగా వేరే గీత వెంట కోయబడింది, అందుకే తరంగ అంచులు సరిపోవు. పాత కాగితపు లెక్క కర్రలు దీన్ని తిరస్కరించేవి. కానీ QR కోడ్‌లలో జత రహస్యం ఉంది, కాబట్టి జంట ఇప్పటికీ నిజమైనదిగా రుజువవుతుంది.',
    'ఇప్పుడు ఎవరో కార్మికుడి సగంలోని అన్నింటితో నకిలీ ఫాయిల్ ముద్రిస్తారు: పేరు, సంఖ్యలు, అదే కోత కూడా. అంచులు సరిగ్గా సరిపోతాయి. కానీ QR లోని రహస్యాన్ని ఒక సగం నుంచి కాపీ చేసి మరొకటి సృష్టించలేరు, కాబట్టి నకిలీ విఫలమవుతుంది, కాలిపోతుంది.',
    'జీతం రోజున అంగీకరించిన రోజులు జీతం చీటీ అవుతాయి, డబ్బు మార్చలేని లెడ్జర్‌లో నమోదవుతుంది, కార్డుకు రెండుసార్లు చెల్లించలేరు. బాకీ వచ్చే నెలకు కొనసాగుతుంది, తదుపరి కార్డులో లాక్ అయి.',
    'పార్లమెంట్‌ను కాల్చిన లెక్క కర్రలు మరణం నుంచి తిరిగి వచ్చాయి. కాగితమే భద్రత. ఇరువైపులా ఒకే రికార్డు ఉంది, యాప్‌ను, సర్వర్‌ను, ఒకరినొకరిని నమ్మాల్సిన అవసరం లేదు.',
  ],
  v: {
    mismatchPairing: '⛔ జత కోడ్‌లు సరిపోలేదు. కోత సరిగ్గా సరిపోయింది, కానీ రహస్యాన్ని కాపీ చేయలేకపోయారు.',
    mismatch: '⛔ ఈ రెండు సగాలు ఒకదానికొకటి చెందినవి కావు.',
    disputed: '⚠ నిజమైన జంట, కానీ {days}వ రోజు ఒక సగంలో మాత్రమే ఉంది. అంగీకరించినవి: {n} రోజులు.',
    sloppy: '✅ నిజమైన జంట, అంచులు సరిపోకపోయినా: జత కోడ్ దాన్ని రుజువు చేస్తుంది. {n} రోజులు సరిపోయాయి.',
    ok: '✅ నిజమైన జంట, జత కోడ్ ధృవీకరించబడింది. రెండు సగాల్లోనూ {n} రోజులు సరిపోతాయి.',
  },
};

const mr: StoryPack = {
  code: 'mr', name: 'मराठी', speech: 'mr-IN',
  title: ['१८३४ · आग', 'काठी का? तिची फाळणी व्हायची.', 'मृत्यूतून परत आली', 'आरोप', 'चलाख छिद्र', 'कापणी ठीक नाही? हरकत नाही.', 'अगदी बसणारी बनावट', 'एकदाच भरणा', 'मृत्यूतून परत'],
  short: ['आग', 'फाळणी', 'पुनर्जन्म', 'आरोप', 'जादा छिद्र', 'वाकडी कापणी', 'बनावट', 'भरणा', 'शेवट'],
  text: [
    'सातशे वर्षे इंग्लंडने आपला हिशेब खाचा पाडलेल्या हेझेल काठ्यांवर ठेवला. ऑक्टोबर १८३४ मध्ये जुन्या काठ्या हाउस ऑफ लॉर्ड्सच्या खालच्या भट्ट्यांत टाकल्या गेल्या. धुराड्यांना आग लागली आणि संसद भवन जळून खाक झाले.',
    'टॅलीची लांबीत फाळणी केली जायची. धनको स्टॉक ठेवायचा, ऋणको फॉइल. फसवायचे तर कोणालाही न दिसणारा धागा जुळवावा लागे. दोन्ही अर्धे हाच पुरावा होता.',
    'आजही कोट्यवधी कामगारांना रोजची मजुरी रोख मिळते, लिखित काहीच नसते. स्टॉक अँड फॉइल टॅलीला पुन्हा जिवंत करते: लहरी रेषेवर दोन तुकडे केलेले कार्ड. कामगार एक अर्धे ठेवतो, मालक दुसरे, आणि रोज संध्याकाळी दोन्हींना एकत्र छिद्र पाडले जाते.',
    'कंत्राटदार: तू फक्त चार दिवस काम केलेस. रमेशकडे फोन नाही, पगाराची पावती नाही, साक्षीदार नाही. पण त्याच्या अर्ध्यात पाच छिद्रे आहेत, आणि जोडी खरी आहे हे स्कॅनर पक्के करतो: दोन्ही अर्ध्यांत जुळणारे गुप्त कोड आहेत.',
    'कोणीतरी फक्त एका अर्ध्यात सहावे छिद्र पाडतो. दुसऱ्या अर्ध्यात ते कधीच नव्हते. स्कॅनर दोन्ही अर्धे तपासतो आणि फक्त एकाच बाजूला असलेले छिद्र दाखवतो. त्याचे पैसे कधीच दिले जात नाहीत.',
    'हाताने कापणे कधीच अचूक नसते. इथे फॉइल पूर्णपणे वेगळ्या रेषेवर कापले आहे, म्हणून लहरी कडा जुळत नाहीत. जुन्या कागदी टॅली नाकारल्या गेल्या असत्या. पण QR कोडमध्ये जोडीचे गुप्त कोड आहे, म्हणून जोडी तरीही खरी सिद्ध होते.',
    'आता कोणीतरी कामगाराच्या अर्ध्यावरील सर्व काही वापरून बनावट फॉइल छापतो: नाव, आकडे, अगदी तीच कापणी. कडा अगदी बरोबर बसतात. पण QR मधील गुप्त कोड एका अर्ध्यावरून नक्कल करून दुसरे तयार करता येत नाही, म्हणून बनावट अयशस्वी होते, आणि जळते.',
    'पगाराच्या दिवशी ठरलेले दिवस पगार पावती बनतात, पैसे छेडछाड-रोधक खतावणीत नोंदवले जातात, आणि कार्डाचे पैसे दोनदा देता येत नाहीत. बाकी रक्कम पुढच्या महिन्यात पुढे जाते, पुढच्या कार्डात बंद होऊन.',
    'ज्या टॅली काठ्यांनी संसद जाळली त्या मृत्यूतून परत आल्या आहेत. कागद हीच सुरक्षा. दोन्ही बाजूंकडे एकच नोंद आहे, आणि कोणालाही अॅप, सर्व्हर किंवा एकमेकांवर विश्वास ठेवावा लागत नाही.',
  ],
  v: {
    mismatchPairing: '⛔ जोडीचे कोड जुळत नाहीत. कापणी अगदी जुळली, पण गुप्त कोडची नक्कल करता आली नाही.',
    mismatch: '⛔ हे दोन अर्धे एकमेकांचे नाहीत.',
    disputed: '⚠ खरी जोडी, पण दिवस {days} फक्त एका अर्ध्यावर आहे. ठरलेले: {n} दिवस.',
    sloppy: '✅ खरी जोडी, कडा जुळत नसल्या तरी: जोडीचा कोड ते सिद्ध करतो. {n} दिवस जुळतात.',
    ok: '✅ खरी जोडी, जोडीचा कोड तपासला. दोन्ही अर्ध्यांवर {n} दिवस जुळतात.',
  },
};

const es: StoryPack = {
  code: 'es', name: 'Español', speech: 'es-ES',
  title: ['1834 · El incendio', '¿Por qué un palo? Se partía.', 'Vuelve de entre los muertos', 'La acusación', 'El agujero tramposo', '¿Un corte torpe? No importa.', 'La falsificación que encaja a la perfección', 'Se paga una vez. Solo una.', 'De vuelta de entre los muertos'],
  short: ['El incendio', 'La partición', 'Resurrección', 'La acusación', 'Agujero extra', 'Corte torpe', 'Falsificación', 'Pagado', 'El final'],
  text: [
    'Durante setecientos años Inglaterra llevó sus cuentas en varas de avellano con muescas. En octubre de 1834 las viejas varas se echaron a los hornos bajo la Cámara de los Lores. Las chimeneas se incendiaron y el Parlamento ardió por completo.',
    'Una tarja se partía a lo largo. El acreedor guardaba la matriz y el deudor el talón. Para engañar había que igualar una veta que nadie ve. Las dos mitades eran la prueba.',
    'Hoy millones de trabajadores siguen cobrando por día, en efectivo, sin nada por escrito. Matriz y Talón resucita la tarja: una tarjeta cortada en dos por una línea ondulada. El trabajador guarda una mitad, el empleador la otra, y cada tarde se perforan juntas.',
    'Contratista: solo trabajaste cuatro días. Ramesh no tiene teléfono, ni recibo, ni testigos. Pero su mitad tiene cinco agujeros, y el escáner confirma que la pareja es auténtica: ambas mitades llevan códigos secretos que coinciden.',
    'Alguien perfora un sexto agujero en una sola mitad. La otra nunca lo recibió. El escáner compara ambas mitades y muestra el agujero que existe solo de un lado. Nunca se paga.',
    'Cortar a mano nunca es perfecto. Aquí el talón se cortó por una línea totalmente distinta, así que los bordes ondulados no encajan. Las viejas tarjas de papel se habrían rechazado. Pero los QR llevan un secreto de emparejamiento, y la pareja sigue probándose auténtica.',
    'Ahora alguien imprime un talón falso con todo lo de la mitad del trabajador: el nombre, las cifras, incluso el mismo corte. Los bordes encajan perfectamente. Pero el secreto del QR no se puede copiar de una mitad para inventar la otra, así que la falsificación falla, y arde.',
    'El día de pago los días acordados se convierten en un recibo, el dinero se anota en un libro a prueba de manipulaciones y la tarjeta no puede pagarse dos veces. Un saldo pendiente pasa al mes siguiente, fijado en la nueva tarjeta.',
    'Las tarjas que quemaron el Parlamento han vuelto de entre los muertos. El papel es la seguridad. Ambas partes tienen el mismo registro, y nadie tiene que confiar en una aplicación, un servidor ni en la otra persona.',
  ],
  v: {
    mismatchPairing: '⛔ Los códigos de emparejamiento no encajan. El corte coincidía a la perfección, pero el secreto no pudo copiarse.',
    mismatch: '⛔ Estas mitades NO van juntas.',
    disputed: '⚠ Pareja auténtica, pero el día {days} está solo en una mitad. Acordado: {n} días.',
    sloppy: '✅ Pareja auténtica, aunque los bordes no encajan: el código de emparejamiento lo prueba. {n} días coinciden.',
    ok: '✅ Pareja auténtica, código de emparejamiento verificado. {n} días coinciden en ambas mitades.',
  },
};

const fr: StoryPack = {
  code: 'fr', name: 'Français', speech: 'fr-FR',
  title: ['1834 · L’incendie', 'Pourquoi un bâton ? On le fendait.', 'Il revient d’entre les morts', 'L’accusation', 'Le trou en trop', 'Une coupe approximative ? Aucun souci.', 'La contrefaçon qui s’ajuste parfaitement', 'Payé une fois. Une seule.', 'De retour d’entre les morts'],
  short: ['L’incendie', 'La fente', 'Résurrection', 'L’accusation', 'Trou en trop', 'Coupe brouillonne', 'Contrefaçon', 'Payé', 'La fin'],
  text: [
    'Pendant sept cents ans, l’Angleterre a tenu ses comptes sur des bâtons de noisetier entaillés. En octobre 1834, les vieux bâtons furent jetés dans les fourneaux sous la Chambre des lords. Les cheminées prirent feu, et le Parlement brûla entièrement.',
    'Une taille était fendue dans la longueur. Le créancier gardait la souche, le débiteur l’éclat. Pour tricher, il fallait imiter un grain que personne ne voit. Les deux moitiés étaient la preuve.',
    'Aujourd’hui, des millions de travailleurs sont encore payés à la journée, en liquide, sans rien d’écrit. Stock & Foil ressuscite la taille : une carte coupée en deux selon une ligne ondulée. Le travailleur garde une moitié, l’employeur l’autre, et chaque soir les deux sont perforées ensemble.',
    'L’entrepreneur : vous n’avez travaillé que quatre jours. Ramesh n’a ni téléphone, ni fiche de paie, ni témoin. Mais sa moitié a cinq trous, et le scanner confirme que la paire est authentique : les deux moitiés portent des codes secrets concordants.',
    'Quelqu’un perfore un sixième trou dans une seule moitié. L’autre ne l’a jamais reçu. Le scanner compare les deux moitiés et montre le trou qui n’existe que d’un côté. Il n’est jamais payé.',
    'Couper à la main n’est jamais parfait. Ici, le talon a été coupé selon une ligne complètement différente : les bords ondulés ne s’ajustent pas. Les anciennes tailles en papier auraient été refusées. Mais les QR codes portent un secret d’appariement, et la paire est quand même prouvée authentique.',
    'Maintenant, quelqu’un imprime un faux talon avec tout ce qui figure sur la moitié du travailleur : le nom, les chiffres, même la même coupe. Les bords s’ajustent parfaitement. Mais le secret du QR ne peut pas être copié d’une moitié pour inventer l’autre : la contrefaçon échoue, et brûle.',
    'Le jour de paie, les jours convenus deviennent une fiche de paie, l’argent est inscrit dans un registre infalsifiable, et la carte ne peut pas être payée deux fois. Un solde dû est reporté au mois suivant, verrouillé dans la carte suivante.',
    'Les bâtons de taille qui ont brûlé le Parlement sont revenus d’entre les morts. Le papier est la sécurité. Les deux parties détiennent le même registre, et personne n’a à faire confiance à une appli, à un serveur, ni à l’autre.',
  ],
  v: {
    mismatchPairing: '⛔ Les codes d’appariement ne correspondent pas. La coupe s’ajustait parfaitement, mais le secret n’a pas pu être copié.',
    mismatch: '⛔ Ces moitiés ne vont PAS ensemble.',
    disputed: '⚠ Paire authentique, mais le jour {days} n’est que sur une moitié. Convenu : {n} jours.',
    sloppy: '✅ Paire authentique, même si les bords ne s’ajustent pas : le code d’appariement le prouve. {n} jours concordent.',
    ok: '✅ Paire authentique, code d’appariement vérifié. {n} jours concordent sur les deux moitiés.',
  },
};

const pt: StoryPack = {
  code: 'pt', name: 'Português', speech: 'pt-BR',
  title: ['1834 · O incêndio', 'Por que um pau? Ele era partido.', 'Volta dos mortos', 'A acusação', 'O furo extra', 'Corte torto? Sem problema.', 'A falsificação que encaixa perfeitamente', 'Pago uma vez. Só uma.', 'De volta dos mortos'],
  short: ['O incêndio', 'A divisão', 'Ressurreição', 'A acusação', 'Furo extra', 'Corte torto', 'Falsificação', 'Pago', 'O fim'],
  text: [
    'Durante setecentos anos a Inglaterra manteve suas contas em varas de aveleira entalhadas. Em outubro de 1834 as velhas varas foram jogadas nas fornalhas sob a Câmara dos Lordes. As chaminés pegaram fogo e o Parlamento queimou por inteiro.',
    'Uma talha era partida no sentido do comprimento. O credor ficava com a matriz e o devedor com o canhoto. Para trapacear era preciso imitar uma veia que ninguém vê. As duas metades eram a prova.',
    'Hoje milhões de trabalhadores ainda recebem por dia, em dinheiro, sem nada por escrito. Stock & Foil ressuscita a talha: um cartão cortado em dois por uma linha ondulada. O trabalhador fica com uma metade, o empregador com a outra, e toda tarde as duas são furadas juntas.',
    'Empreiteiro: você só trabalhou quatro dias. Ramesh não tem telefone, nem holerite, nem testemunha. Mas a metade dele tem cinco furos, e o scanner confirma que o par é genuíno: as duas metades têm códigos secretos que combinam.',
    'Alguém fura um sexto buraco em apenas uma metade. A outra nunca o recebeu. O scanner compara as duas metades e mostra o furo que existe só de um lado. Ele nunca é pago.',
    'Cortar à mão nunca é perfeito. Aqui o canhoto foi cortado por uma linha completamente diferente, então as bordas onduladas não encaixam. As antigas talhas de papel seriam rejeitadas. Mas os QR codes levam um segredo de pareamento, e o par continua provado genuíno.',
    'Agora alguém imprime um canhoto falso com tudo o que está na metade do trabalhador: o nome, os números, até o mesmo corte. As bordas encaixam perfeitamente. Mas o segredo do QR não pode ser copiado de uma metade para inventar a outra, então a falsificação falha, e queima.',
    'No dia do pagamento os dias combinados viram um holerite, o dinheiro é registrado em um livro à prova de adulteração e o cartão não pode ser pago duas vezes. Um saldo devido passa para o mês seguinte, travado no próximo cartão.',
    'As talhas que queimaram o Parlamento voltaram dos mortos. O papel é a segurança. Os dois lados têm o mesmo registro, e ninguém precisa confiar em um aplicativo, em um servidor ou um no outro.',
  ],
  v: {
    mismatchPairing: '⛔ Os códigos de pareamento não combinam. O corte encaixava perfeitamente, mas o segredo não pôde ser copiado.',
    mismatch: '⛔ Estas metades NÃO pertencem ao mesmo par.',
    disputed: '⚠ Par genuíno, mas o dia {days} está só em uma metade. Combinado: {n} dias.',
    sloppy: '✅ Par genuíno, mesmo com as bordas sem encaixar: o código de pareamento prova. {n} dias coincidem.',
    ok: '✅ Par genuíno, código de pareamento verificado. {n} dias coincidem nas duas metades.',
  },
};

const sw: StoryPack = {
  code: 'sw', name: 'Kiswahili', speech: 'sw-KE',
  title: ['1834 · Moto', 'Kwa nini kijiti? Kiligawanywa.', 'Kimerudi kutoka kwa wafu', 'Madai', 'Tundu la ujanja', 'Kata mbovu? Hakuna shida.', 'Ughushi unaolingana kikamilifu', 'Kulipwa mara moja tu', 'Kimerudi kutoka kwa wafu'],
  short: ['Moto', 'Mgawanyo', 'Ufufuo', 'Madai', 'Tundu la ziada', 'Kata mbovu', 'Ughushi', 'Imelipwa', 'Mwisho'],
  text: [
    'Kwa miaka mia saba Uingereza ilihifadhi hesabu zake kwenye vijiti vya mhazeli vyenye makovu. Oktoba 1834 vijiti vya zamani vilitupwa kwenye tanuru chini ya Baraza la Mabwana. Mabomba ya moshi yaliwaka moto, na Bunge likaungua lote.',
    'Kijiti cha hesabu kiligawanywa kwa urefu. Mdai alibaki na sehemu moja, mdaiwa na nyingine. Ili kudanganya ilibidi ulinganishe nyuzi ambazo hakuna anayeziona. Nusu mbili zilikuwa ushahidi.',
    'Leo mamilioni ya wafanyakazi bado hulipwa kwa siku, kwa fedha taslimu, bila maandishi yoyote. Stoki na Foili hufufua kijiti hicho: kadi iliyokatwa mara mbili kwa mstari wa mawimbi. Mfanyakazi anabaki na nusu moja, mwajiri nusu nyingine, na kila jioni zote hutobolewa pamoja.',
    'Mkandarasi: ulifanya kazi siku nne tu. Ramesh hana simu, hana karatasi ya malipo, hana shahidi. Lakini nusu yake ina matundu matano, na kichanganuzi kinathibitisha kuwa jozi ni halisi: nusu zote mbili zina misimbo ya siri inayolingana.',
    'Mtu anatoboa tundu la sita kwenye nusu moja tu. Nusu nyingine haikulipata kamwe. Kichanganuzi kinalinganisha nusu zote mbili na kuonyesha tundu lililopo upande mmoja tu. Halilipwi kamwe.',
    'Kukata kwa mkono hakuwi kamilifu kamwe. Hapa foili ilikatwa kwa mstari tofauti kabisa, kwa hiyo kingo za mawimbi hazilingani. Vijiti vya karatasi vya zamani vingekataliwa. Lakini misimbo ya QR ina siri ya kuoanisha, kwa hiyo jozi bado inathibitishwa kuwa halisi.',
    'Sasa mtu anachapisha foili bandia akitumia kila kitu kwenye nusu ya mfanyakazi: jina, namba, hata mkato uleule. Kingo zinalingana kikamilifu. Lakini siri iliyo kwenye QR haiwezi kunakiliwa kutoka nusu moja kubuni nyingine, kwa hiyo ughushi unashindwa, na unaungua.',
    'Siku ya malipo siku zilizokubaliwa huwa karatasi ya malipo, pesa inaandikwa kwenye daftari lisilochezewa, na kadi haiwezi kulipwa mara mbili. Deni linalobaki linahamia mwezi ujao, limefungwa kwenye kadi inayofuata.',
    'Vijiti vya hesabu vilivyochoma Bunge vimerudi kutoka kwa wafu. Karatasi ndiyo ulinzi. Pande zote mbili zina rekodi ileile, na hakuna anayehitaji kuamini programu, seva, au mwenzake.',
  ],
  v: {
    mismatchPairing: '⛔ Misimbo ya kuoanisha haifanani. Mkato ulilingana kikamilifu, lakini siri haikuweza kunakiliwa.',
    mismatch: '⛔ Nusu hizi HAZIHUSIANI.',
    disputed: '⚠ Jozi halisi, lakini siku {days} iko nusu moja tu. Imekubaliwa: siku {n}.',
    sloppy: '✅ Jozi halisi, ingawa kingo hazilingani: msimbo wa kuoanisha unathibitisha. Siku {n} zinakubaliana.',
    ok: '✅ Jozi halisi, msimbo wa kuoanisha umethibitishwa. Siku {n} zinakubaliana kwenye nusu zote mbili.',
  },
};

const ar: StoryPack = {
  code: 'ar', name: 'العربية', speech: 'ar-SA', rtl: true,
  title: ['١٨٣٤ · الحريق', 'لماذا عصا؟ كانت تُشَقّ.', 'تعود من بين الأموات', 'الادعاء', 'الثقب المخادع', 'قصّ غير متقن؟ لا بأس.', 'التزوير الذي يطابق تمامًا', 'يُدفع مرة واحدة فقط', 'عودة من بين الأموات'],
  short: ['الحريق', 'الشقّ', 'البعث', 'الادعاء', 'ثقب زائد', 'قصّ غير متقن', 'التزوير', 'مدفوع', 'النهاية'],
  text: [
    'طوال سبعمئة عام حفظت إنجلترا حساباتها على عصيّ البندق المحزَّزة. وفي أكتوبر ١٨٣٤ أُلقيت العصيّ القديمة في الأفران تحت مجلس اللوردات. اشتعلت المداخن واحترق مبنى البرلمان بالكامل.',
    'كانت عصا الحساب تُشَقّ بالطول. يحتفظ الدائن بالأصل والمدين بالنسخة. وللغش كان عليك مطابقة ألياف لا يراها أحد. وكان النصفان هما الدليل.',
    'اليوم ما زال ملايين العمال يتقاضون أجرهم باليوم نقدًا ودون أي شيء مكتوب. يبعث «ستوك آند فويل» عصا الحساب من جديد: بطاقة مقطوعة نصفين على خط متموّج. يحتفظ العامل بنصف وصاحب العمل بالآخر، وكل مساء يُثقَب النصفان معًا.',
    'المقاول: عملتَ أربعة أيام فقط. رامش ليس لديه هاتف ولا كشف راتب ولا شاهد. لكن في نصفه خمسة ثقوب، والماسح يؤكد أن الزوج أصلي: يحمل النصفان رموزًا سرية متطابقة.',
    'يثقب أحدهم ثقبًا سادسًا في نصف واحد فقط. النصف الآخر لم يحصل عليه أبدًا. يقارن الماسح النصفين ويُظهر الثقب الموجود في جهة واحدة فقط. ولا يُدفع عنه شيء أبدًا.',
    'القصّ اليدوي لا يكون متقنًا أبدًا. هنا قُصّ النصف الثاني على خط مختلف تمامًا، فلا تتطابق الحواف المتموّجة. كانت عصيّ الحساب الورقية القديمة سترفض ذلك. لكن رموز QR تحمل سرّ اقتران، فيثبت أن الزوج أصلي رغم ذلك.',
    'الآن يطبع أحدهم نصفًا مزوّرًا بكل ما في نصف العامل: الاسم والأرقام وحتى القصّ نفسه. تتطابق الحواف تمامًا. لكن السرّ في رمز QR لا يمكن نسخه من نصف لاختراع الآخر، فيفشل التزوير ويحترق.',
    'في يوم الدفع تتحول الأيام المتفق عليها إلى كشف أجر، ويُسجَّل المال في دفتر محصَّن ضد التلاعب، ولا يمكن دفع البطاقة مرتين. والرصيد المستحق ينتقل إلى الشهر التالي مقفلًا في البطاقة الجديدة.',
    'عادت عصيّ الحساب التي أحرقت البرلمان من بين الأموات. الورق هو الأمان. لدى الطرفين السجلّ نفسه، ولا يحتاج أحد إلى الثقة بتطبيق أو خادم أو بالطرف الآخر.',
  ],
  v: {
    mismatchPairing: '⛔ رموز الاقتران لا تتطابق. كان القصّ مطابقًا تمامًا، لكن السرّ لم يمكن نسخه.',
    mismatch: '⛔ هذان النصفان لا ينتميان معًا.',
    disputed: '⚠ زوج أصلي، لكن اليوم {days} موجود في نصف واحد فقط. المتفق عليه: {n} أيام.',
    sloppy: '✅ زوج أصلي رغم عدم تطابق الحواف: رمز الاقتران يثبت ذلك. تتطابق {n} أيام.',
    ok: '✅ زوج أصلي، تم التحقق من رمز الاقتران. تتطابق {n} أيام في النصفين.',
  },
};

export const STORY_LANGS: StoryPack[] = [en, hi, bn, ta, te, mr, es, fr, pt, sw, ar];
export const storyPack = (code: string): StoryPack => STORY_LANGS.find((p) => p.code === code) ?? en;

export type VerdictKind = keyof StoryPack['v'];
/** Fill a verdict sentence's {n} / {days} placeholders. */
export const formatVerdict = (pack: StoryPack, kind: VerdictKind, vars: { n?: number; days?: string } = {}) =>
  pack.v[kind].replace('{n}', String(vars.n ?? '')).replace('{days}', vars.days ?? '');
