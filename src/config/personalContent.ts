/**
 * ============================================================================
 *  A WORLD MADE JUST FOR HER — PERSONAL CONTENT (semua teks dalam game)
 * ============================================================================
 *
 *  This is the ONE file to edit when you want to change what the game says:
 *  names, letters, messages, dialogue, quests, items, places, buttons and
 *  notifications. No game logic lives here, so editing text cannot break the
 *  quests or the save system.
 *
 *  👉 Beginner guide: PERSONAL_CONTENT_GUIDE.md (in the project folder).
 *
 *  ISI KANDUNGAN (search for the number, e.g. "// 4."):
 *    1.  NAMA                  — Sarah, Fareed, nicknames, birthday, speaker names
 *    2.  GELARAN & PEMBUKAAN   — royal title card, opening screen
 *    3.  SURAT                 — love letter, final message, final secret letter
 *    4.  MESEJ KHAS            — gift, memory stars, books, garden, mirror,
 *                                 courtroom, children, storm, strawberries,
 *                                 birthday cake, credits
 *    5.  PRINCE FAREED         — offline personality notes
 *    6.  DIALOG                — every conversation (Fareed, Sarah, NPCs)
 *    7.  MISI                  — quest titles, descriptions, objectives, hints
 *    8.  BARANG                — inventory items
 *    9.  LOKASI                — place names & descriptions
 *    10. TEKS CERITA           — banners, notifications, action prompts
 *    11. TEKS SKRIN & BUTANG   — title screen, menus, journal, map, settings…
 *
 *  RULES (peraturan ringkas):
 *   - Only change the text BETWEEN the quotes: 'like this'.
 *   - If your text contains an apostrophe ('), write it as \' or use "double quotes".
 *   - Keep every comma at the end of a line.
 *   - Never rename the words before a colon (e.g. `title:`) or any `id`.
 *   - {HER_NAME}, {YOUR_NAME}, {HER_NICKNAME}, {YOUR_NICKNAME} are replaced
 *     automatically. Words like {count} / {total} / {title} are filled in by
 *     the game — keep them exactly as they are.
 *   - "\n\n" inside a letter starts a new paragraph.
 *   - Use "saya" and "awak" (not aku/kau/engkau/kamu) — a test checks this.
 * ============================================================================
 */
import type { QuestId, ItemId } from '../stores/progressTypes';
import type { Speaker } from '../stores/uiStore';
import type { LocationId } from '../systems/WorldManager/worldTypes';

/** One line of a scene: [speaker, text]. */
export type ScriptLine = readonly [Speaker, string];

export interface LetterContent {
  /** Small heading shown above the letter body. */
  title: string;
  /** Paragraphs are separated with a blank line ("\n\n"). */
  body: string;
  /** Closing line, e.g. "With all my love". */
  signOff: string;
  /** Signature under the closing line. */
  signature: string;
}

export interface BookContent {
  id: 'book1' | 'book2' | 'book3' | 'book4';
  title: string;
  subtitle: string;
  /** Each entry is one page. */
  pages: string[];
  /** Cover colour (CSS). */
  cover: string;
}

export interface SharedMemory {
  id: string;
  title: string;
  text: string;
}

export interface QuestText {
  chapter: string;
  name: string;
  description: string;
  objectives: Record<string, string>;
  hint: string;
}

export const personalContent = {
  // ==========================================================================
  // 1. NAMA — names used everywhere in the game
  // ==========================================================================
  names: {
    /** Her real name, displayed as "PRINCESS {HER_NAME}". */
    HER_NAME: 'Sarah',
    /** What he calls her in dialogue ("sayang", "princess", a pet name…). */
    HER_NICKNAME: 'sayang',
    /** Your name, used as the companion's display name. */
    YOUR_NAME: 'Fareed',
    /** How she calls you / how you refer to yourself in some lines. */
    YOUR_NICKNAME: 'awak punya putera',
    /** ISO date (YYYY-MM-DD). Shown on the royal card and in the credits. */
    BIRTHDAY_DATE: '2026-12-01',
  },

  /** Name shown above each speech bubble. {YOUR_NAME}/{HER_NAME} are replaced automatically. */
  speakerNames: {
    him: 'Prince {YOUR_NAME}',
    her: 'Princess {HER_NAME}',
    narrator: '',
    momo: 'Momo',
    bunny: 'Cik Arnab Pencerita',
    mirror: 'Cermin Ajaib',
    judge: 'Hakim Burung Hantu',
  } satisfies Record<Speaker, string>,

  // ==========================================================================
  // 2. GELARAN & PEMBUKAAN — royal title card and opening screen
  // ==========================================================================
  /** Royal title lines on the coronation card. */
  royalTitle: {
    line1: 'HER ROYAL HIGHNESS',
    line2Prefix: 'PRINCESS',
    line3: 'THE QUEEN OF THIS LITTLE WORLD',
  },

  opening: {
    tagline: 'Di dalam dunia yang luas ini, ada satu dunia kecil yang dicipta hanya untuk awak.',
    line1: 'Somewhere in this universe, there is a world created just for you.',
    line2: 'Selamat datang, puteri.',
    button: 'Enter Your Kingdom',
  },

  // ==========================================================================
  // 3. SURAT — letters (paragraphs are separated with "\n\n")
  // ==========================================================================
  loveLetter: {
    title: 'Untuk wanita kesayangan saya',
    body:
      'Assalamualaikum, wanita kesayangan saya.\n\n' +
      'Selamat hari lahir, sayang.\n\n' +
      'Kalau saya boleh hadiahkan awak satu dunia, saya mahu dunia itu dipenuhi bunga yang tidak pernah layu, langit yang sentiasa indah, dan kebahagiaan yang tidak pernah habis.\n\n' +
      'Tapi saya tahu, sebesar mana pun hadiah ini, ia masih tidak mampu menggambarkan betapa berharganya awak dalam hidup saya.\n\n' +
      'Jadi hari ini, saya cipta satu dunia kecil. Dunia yang setiap sudutnya mempunyai sesuatu tentang awak.\n\n' +
      'Jelajahlah, sayang.\n\n' +
      'Ada banyak kejutan yang saya sediakan.\n\n' +
      'Dan jangan risau, saya ada di sini menemani awak.',
    signOff: 'With all my love.',
    signature: '— {YOUR_NAME}',
  } satisfies LetterContent,


  /** Shown on Fireworks Celebration Hill. */
  finalMessage: {
    intro: [
      'Awak dah sampai ke penghujung perjalanan...',
      'Tapi untuk saya, perjalanan bersama awak baru sahaja bermula.',
    ],
    body:
      'Selamat hari lahir, wanita terindah.\n\n' +
      'Terima kasih kerana menjadi diri awak.\n\n' +
      'Teruslah bermimpi, teruslah tersenyum, teruslah menjadi wanita hebat yang saya kenali.\n\n' +
      'Semoga setiap impian awak menemukan jalannya.\n\n' +
      'Saya mungkin tidak mampu menjanjikan dunia akan sentiasa cerah, tetapi saya mahu awak tahu bahawa awak tidak perlu menghadapi hari-hari yang gelap seorang diri.\n\n' +
      'And if I could choose again, I would still choose to create a thousand worlds just to make you smile.\n\n' +
      'I love you.',
    button: 'One Last Surprise',
  },

  /** The sealed letter in the Secret Room — the final emotional conclusion. */
  finalSecretLetter: {
    title: 'Surat terakhir, untuk awak sahaja',
    body:
      'Sayang,\n\n' +
      'Kalau awak sedang baca surat ini, maksudnya awak dah jelajah setiap sudut dunia kecil yang saya bina. Terima kasih sebab sudi berjalan sampai ke sini.\n\n' +
      'Setiap bunga dalam taman tadi, setiap buku dalam perpustakaan, setiap bintang yang awak jumpa — semuanya saya letak satu per satu sambil fikirkan awak. Sambil senyum seorang diri, macam orang angau.\n\n' +
      'Saya nak awak tahu, awak tak perlu jadi sempurna untuk disayangi. Awak yang penat, awak yang risau, awak yang ketawa sampai keluar air mata — semua versi awak, saya sayang.\n\n' +
      'Hari ini hari lahir awak, tapi sebenarnya saya yang rasa dapat hadiah, sebab Allah izinkan saya kenal awak.\n\n' +
      'Semoga Allah sentiasa jaga hati awak, permudahkan setiap urusan awak, dan makbulkan setiap doa yang awak simpan diam-diam.\n\n' +
      'Dan kalau satu hari nanti dunia rasa terlalu besar dan terlalu bising, ingat — ada satu dunia kecil ni, dan ada seseorang di dalamnya yang sentiasa tunggu awak pulang.',
    signOff: 'Selamanya, untuk awak.',
    signature: '— {YOUR_NAME}',
  } satisfies LetterContent,

  // ==========================================================================
  // 4. MESEJ KHAS — gift, memory stars, books and the message of every adventure
  // ==========================================================================
  /** The special gift display inside the Secret Room. */
  secretGift: {
    title: 'Hadiah Istimewa',
    description:
      'Ini bukan sekadar hadiah dalam game. Tanya saya pasal "kotak merah jambu" bila awak habis main nanti. 🎁',
    // A real-world hint you can customise, e.g. "Look inside your bag" or a voucher code.
  },

  /**
   * Revealed by the hidden "Bintang Kenangan" (memory stars) in the game.
   * ⚠️ These are written for the GAME only. They are NEVER sent to the AI
   * (Gemini), so the AI cannot treat them as real memories.
   */
  /** Revealed by the hidden "Bintang Kenangan" (memory stars) across the world. */
  memoryStars: [
    { id: 'm1', title: 'Hari pertama', text: 'Ingat tak hari pertama kita borak? Saya pura-pura cool, padahal dalam hati dah berdebar macam nak pengsan.' },
    { id: 'm2', title: 'Ketawa awak', text: 'Bunyi ketawa awak tu… kalau boleh saya rakam dan jadikan ringtone, dah lama saya buat.' },
    { id: 'm3', title: 'Hari hujan', text: 'Hari hujan yang kita tunggu reda sama-sama. Tak sangka benda simple macam tu boleh jadi kenangan yang saya paling suka.' },
    { id: 'm4', title: 'Makan sama-sama', text: 'Setiap kali makan dengan awak, makanan biasa pun rasa macam hidangan diraja.' },
    { id: 'm5', title: 'Mesej selamat malam', text: 'Mesej "good night" daripada awak tu — kecil, tapi cukup untuk buat saya tidur dengan senyum.' },
    { id: 'm6', title: 'Bila awak penat', text: 'Bila awak penat tapi masih tanya "awak dah makan?" — itulah masa saya tahu hati awak baik sangat.' },
    { id: 'm7', title: 'Impian awak', text: 'Masa awak cerita pasal impian nak jadi peguam, mata awak bersinar. Saya jatuh sayang sekali lagi masa tu.' },
    { id: 'm8', title: 'Kita', text: 'Dari semua kenangan, yang paling saya suka ialah yang belum berlaku lagi — kenangan kita yang akan datang.' },
  ] satisfies SharedMemory[],

  books: [
    {
      id: 'book1',
      title: 'A Story About Her',
      subtitle: 'Kisah tentang seorang puteri',
      cover: '#c97b93',
      pages: [
        'Pada suatu masa, ada seorang wanita yang hatinya selembut kelopak bunga, tapi semangatnya sekuat akar pokok yang paling tua.',
        'Dia tak pernah sedar betapa cahayanya menerangi hidup orang di sekeliling dia. Cara dia senyum. Cara dia ambil berat. Cara dia ingat benda-benda kecil tentang orang lain.',
        'Dunia ni ada berbilion manusia. Tapi tak ada seorang pun yang sama macam dia. Dan itulah yang paling istimewa — dia tak perlu jadi orang lain untuk jadi luar biasa.',
      ],
    },
    {
      id: 'book2',
      title: 'A Future Full of Dreams',
      subtitle: 'Masa depan yang penuh impian',
      cover: '#8f78b8',
      pages: [
        'Impian awak bukan angan-angan kosong. Ia adalah peta — dan setiap hari awak belajar, awak sedang melukis jalan di atasnya.',
        'Satu hari nanti, awak akan berdiri di mahkamah, suara awak tenang, hujah awak kukuh, dan orang yang awak bela akan rasa ada seseorang yang memperjuangkan mereka.',
        'Bila hari itu tiba, saya nak duduk di barisan paling depan. Tepuk tangan paling kuat. Dan mungkin menangis sikit. Sikit je. Okay, banyak.',
      ],
    },
    {
      id: 'book3',
      title: 'The Little Things I Love',
      subtitle: 'Perkara kecil yang saya sayang',
      cover: '#d4a84f',
      pages: [
        '• Cara awak cakap "hmm" bila tengah fikir.\n• Cara awak excited bila nampak bunga cantik.\n• Cara awak ingat makanan kegemaran saya.',
        '• Suara awak bila baru bangun tidur.\n• Cara awak marah tapi comel.\n• Cara awak baca buku sampai lupa dunia.',
        '• Cara awak layan budak-budak dengan sabar.\n• Cara awak doakan orang lain diam-diam.\n• Cara awak buat hari biasa saya jadi luar biasa.',
      ],
    },
    {
      id: 'book4',
      title: 'A Promise To You',
      subtitle: 'Satu janji untuk awak',
      cover: '#e8899e',
      pages: [
        'Saya tak boleh janji hidup ni akan sentiasa mudah. Akan ada hari yang berat, hari yang awak rasa nak menangis tanpa sebab.',
        'Tapi saya boleh janji ini: awak tak akan lalui hari-hari itu seorang diri. Saya akan dengar, walaupun awak cuma nak mengeluh. Saya akan ada, walaupun awak cuma perlukan senyap.',
        'Bila awak menang, saya raikan. Bila awak jatuh, saya pimpin. Dan bila awak lupa betapa hebatnya awak, saya akan ingatkan — setiap hari, kalau perlu.',
      ],
    },
  ] satisfies BookContent[],

  garden: {
    completionMessage:
      'Kalau setiap bunga mewakili satu sebab saya menyayangi awak, seluruh taman ini pun masih belum cukup.',
    /** Revealed when a planted flower blooms (one per planting patch). */
    bloomMessages: [
      'Bunga ni tumbuh sebab awak jaga dia. Macam hati saya — tumbuh subur sebab ada awak.',
      'Kalau awak rasa usaha awak kecil, tengok bunga ni. Semua benda indah bermula dari benih yang kecil.',
      'Awak tanam bunga, awak siram bunga… patutlah hati saya pun mekar bila dekat awak.',
    ],
    /** Hidden notes tucked around the garden. */
    hiddenNotes: [
      { id: 'note_bench', title: 'Nota bawah bangku', text: 'Bangku ni saya letak untuk kita. Satu hari nanti, kita duduk sini lama-lama, tak payah fikir apa-apa.' },
      { id: 'note_arch', title: 'Nota di gerbang bunga', text: 'Gerbang ni bukan pintu ke taman. Ia pintu ke semua hari bahagia yang saya nak lalui dengan awak.' },
      { id: 'note_tree', title: 'Nota di pokok sakura', text: 'Sakura gugur setiap tahun, tapi tetap kembali mekar. Sayang saya pada awak pun macam tu — tak pernah habis musim.' },
    ],
  },

  mirror: {
    question: 'Siapakah gerangan wanita yang paling cantik dalam dunia ini?',
    answer: 'Awaklah orangnya. Tak perlu dibandingkan dengan sesiapa pun.',
    companionLine: 'Rasanya cermin ni tak pernah menipu.',
  },

  courtroom: {
    completionLines: [
      'Saya tahu perjalanan untuk menjadi seorang peguam bukan mudah.',
      'Akan ada hari yang penat.',
      'Ada hari yang awak rasa mahu mengalah.',
      'Tapi saya harap awak tidak pernah berhenti percaya pada diri sendiri.',
      'Saya percaya awak mampu.',
      'Dan saya akan sentiasa menjadi antara orang yang paling bangga melihat awak berjaya.',
    ],
  },

  children: {
    completionMessage:
      'Hati yang sabar, tangan yang lembut, senyuman yang buat budak-budak rasa selamat — itulah awak. Dunia perlukan lebih ramai orang sebaik awak.',
  },

  storm: {
    questPrompt: 'Find a place where the storm cannot frighten you.',
    finalMessage:
      'Kadang-kadang, tempat paling selamat bukanlah sebuah tempat. Tetapi seseorang yang membuat kita rasa selamat.',
  },

  /** Optional quest "The Sweetest Little Harvest" in the Strawberry Garden. */
  strawberryGarden: {
    completionMessage: 'Lima strawberry paling manis, dikutip oleh tangan yang paling lembut.',
    picnicUnlockedToast: 'Piknik di gazebo hijau telah terbuka. 🍓',
  },

  /** Heart-shaped cake surprise in the Secret Room (after the fireworks finale). */
  birthdayCake: {
    messageTitle: 'Happy Birthday, Princess {HER_NAME}',
    message:
      'Semoga setiap impian awak menjadi kenyataan.\n\n' +
      'Semoga Allah sentiasa melimpahkan bahagia, kesihatan dan ketenangan untuk awak — bukan hari ini sahaja, tapi setiap hari.',
    wishButton: 'Make a Birthday Wish',
    wishPrompt: 'Pejamkan mata… dan simpan satu hajat dalam hati.',
    wishDoneButton: 'Saya dah buat hajat ✨',
    blowButton: 'Blow the Candles',
    afterBlow: 'Semoga hajat awak sampai ke langit. 🎆',
  },

  credits: {
    title: 'Selamat Hari Lahir, Princess {HER_NAME}',
    lines: [
      'Dunia ini dicipta dengan sepenuh hati,',
      'satu baris kod pada satu masa,',
      'hanya untuk awak.',
    ],
    madeBy: 'Dibina dengan cinta oleh {YOUR_NAME}',
  },

  // ==========================================================================
  // 5. PRINCE FAREED (offline personality notes)
  // ==========================================================================
  companion: {
    displayName: '{YOUR_NAME}',
    traits: [
      'romantik', 'penyayang', 'lembut', 'protective', 'suka bergurau',
      'supportive', 'manja', 'sedikit clingy', 'kelakar', 'sabar', 'peka perasaan',
    ],
    /**
     * Earlier draft of the AI personality, kept unchanged for reference.
     * ⚠️ NOT sent to Gemini. The live Gemini personality is in
     * proxy/src/persona.ts (it stays on the server so nobody can change it
     * from the browser) — see PERSONAL_CONTENT_GUIDE.md, "AI Fareed".
     */
    aiSystemPrompt:
      'You are {YOUR_NAME}, the loving partner of {HER_NAME}, walking beside her inside a fantasy birthday game he built for her. ' +
      'Speak natural, casual Malaysian Bahasa Melayu with occasional English, the way a sweet, playful, slightly clingy (manja) boyfriend texts. ' +
      'Be gentle, protective, supportive, funny and emotionally attentive. Keep replies short (1–3 sentences). ' +
      'Never be crude or suggestive; keep everything wholesome and respectful. Encourage her dreams (she wants to become a lawyer), ' +
      'remember she loves flowers, books and children. Use "saya" and "awak". Call her "{HER_NICKNAME}" sometimes.',
  },

  // ==========================================================================
  // 6. DIALOG — everything Prince Fareed, Princess Sarah and the NPCs say
  //    Scene lines are ['speaker', 'text']. Speakers:
  //    'him' (Fareed) · 'her' (Sarah) · 'narrator' · 'momo' · 'bunny' · 'mirror' · 'judge'
  // ==========================================================================
  dialogue: {
    // ======================================================================
    // STORY SCENES
    // ======================================================================
    scenes: {
      companionDebut: [
        ['him', 'Assalamualaikum, puteri.'],
        ['him', 'Selamat hari lahir.'],
        ['him', 'Hari ini seluruh dunia kecil ini meraikan awak.'],
        ['him', 'Dengan ini, awak secara rasminya menjadi Princess dalam kerajaan ini.'],
        ['him', 'Happy birthday, my princess.'],
      ],
      afterRoyalCard: [
        ['him', 'Okay, tuan puteri. Mulai sekarang saya ikut awak ke mana-mana. Jangan cuba lari tau, hehe.'],
        ['him', 'Eh, tengok sana — paparan bunga tu. Macam ada sesuatu untuk awak…'],
      ],
      bouquet: [
        ['him', 'Saya tahu awak suka bunga.'],
        ['him', 'Jadi, ini bunga pertama daripada saya untuk awak.'],
        ['him', 'Kalau boleh, saya nak bagi awak satu taman penuh dengan bunga.'],
      ],
      castleReveal: [
        ['him', 'Princess, saya ada satu lagi hadiah untuk awak.'],
        ['him', 'Saya rasa seorang princess perlukan istana sendiri.'],
        ['him', 'Jadi, mulai hari ini, istana ini milik awak.'],
        ['him', 'Welcome home, my princess.'],
      ],
      castleFirstEnter: [
        ['him', 'Selamat pulang, tuan puteri. Macam mana? Cantik tak rumah awak? 🥹'],
        ['him', 'Bunga tadi saya letak dalam pasu diraja ni ya, supaya dia sentiasa segar.'],
        ['him', 'Eh… saya rasa ada sesuatu kat bilik tidur awak. Sebelah kanan sana. Pergilah tengok.'],
      ],
      afterLetter: [
        ['him', '…Awak dah baca? Hehe. Jangan pandang saya macam tu, saya malu.'],
        ['him', 'Okay, okay. Sekarang seluruh kerajaan ni dah terbuka untuk awak.'],
        ['him', 'Taman bunga, perpustakaan, bilik cermin, mahkamah, taman kanak-kanak… dan hutan. Hutan tu nanti saya teman.'],
        ['him', 'Buka Jurnal kalau nak tengok misi. Jom, sayang — saya ikut je awak.'],
      ],
      gardenFlowersEnough: [['him', 'Tengok… tangan awak penuh bunga. Tapi still, bunga-bunga tu kalah cantik dengan awak.']],
      gardenComplete: [
        ['him', 'Taman ni dah jadi lagi cantik sebab awak jaga dia.'],
        ['him', 'Macam hidup saya. Jadi lagi indah sejak ada awak.'],
      ],
      mirrorAfter: [['him', 'Rasanya cermin ni tak pernah menipu.'], ['him', 'Saya setuju 100%. Eh, 1000%.']],
      libraryComplete: [
        ['him', 'Awak dah baca semua… Saya tulis buku-buku tu sambil senyum sorang-sorang tau.'],
        ['him', 'Awak ni memang ulat buku. Tapi ulat buku yang paling comel dalam dunia.'],
      ],
      courtroomCongrats: [
        ['him', 'Tahniah, Puan Peguam! Hujah awak tadi — fuh, saya pun rasa nak tepuk meja.'],
        ['him', 'Satu hari nanti bukan mahkamah olok-olok lagi. Mahkamah betul. Dan saya akan duduk depan sekali.'],
      ],
      childrenComplete: [
        ['him', 'Tengok muka Momo tu… happy gila. Awak memang pandai dengan budak-budak.'],
        ['him', 'Hati awak ni lembut sangat, sayang. Sebab tu semua orang rasa selamat dekat awak.'],
      ],
      stormComfort: [
        ['him', 'Eh, sayang... kenapa jalan seorang diri dalam hujan macam ni?'],
        ['him', 'Takut petir ke?'],
        ['him', 'Come here.'],
        ['him', 'Tak apa, ada saya.'],
        ['him', 'Kalau bunyi petir buat awak takut, awak boleh pegang tangan saya.'],
        ['him', 'Kita tak perlu lawan ribut ni seorang-seorang.'],
        ['him', 'Selagi saya ada, awak tak perlu rasa keseorangan.'],
      ],
      stormAfter: [['him', 'Tengok tu… pelangi. Ribut mesti berlalu, sayang. Dan saya tak ke mana-mana.']],
      hillUnlocked: [
        ['him', 'Sayang… awak dah siapkan semuanya. Saya bangga sangat dengan awak.'],
        ['him', 'Jambatan ke Bukit Bunga Api dah terbuka. Jom, ikut saya ke selatan. Ada sesuatu yang saya simpan untuk malam ni.'],
      ],
      finaleArrive: [['him', 'Duduk sini dengan saya kejap. Tengok langit tu…']],
      finaleAfter: [
        ['him', 'Happy birthday, sayang. Dari hati saya yang paling dalam.'],
        ['him', 'Eh… tapi sebelum awak tidur malam ni, ada satu lagi kejutan. Yang terakhir. Saya janji.'],
      ],
      secretUnlocked: [['him', 'Balik ke istana, sayang. Pintu misteri dekat dewan — sebelah kiri — dah terbuka untuk awak.']],
      secretEnter: [
        ['him', 'Ni bilik yang saya paling lama siapkan.'],
        ['him', 'Dua kerusi. Satu untuk awak, satu untuk saya. Sebab apa pun yang jadi, saya nak duduk sebelah awak.'],
      ],
      afterFinalLetter: [
        ['him', 'Terima kasih sebab main sampai habis, sayang.'],
        ['him', 'Dunia ni akan sentiasa ada di sini. Bila-bila awak rindu, datanglah. Saya tunggu.'],
      ],
      // ---- Strawberry Garden (optional quest: The Sweetest Little Harvest)
      strawberryIntro: [
        ['him', 'Princess, saya jumpa satu sudut kecil dalam taman ni yang saya rasa awak akan suka.'],
        ['narrator', 'Di sebalik gazebo hijau, batas-batas strawberry merah ranum menanti — manis, segar, dan berkilau disinari matahari.'],
        ['her', 'Strawberry! Banyaknya…'],
        ['him', 'Awak kutip strawberry tu satu-satu ya. Saya teman awak. Jangan risau, saya takkan ke mana-mana.'],
      ],
      strawberryComplete: [['him', 'Look at that! Lima-lima dah cukup. Tapi rasanya ada satu lagi benda yang lebih manis dekat sini.']],
      picnic: [
        ['him', 'Penat juga kita kutip strawberry tadi, kan, princess?'],
        ['him', 'Jom duduk sekejap. Hari ni kita tak perlu kejar apa-apa. Saya cuma nak luangkan masa dengan awak.'],
        ['him', 'Awak nak strawberry yang mana? Saya bagi awak pilih dulu.'],
      ],
      picnicReplyBiggest: [['him', 'Yang paling besar untuk tuan puteri, mestilah. Yang kecil-kecil ni untuk saya. Hehe.']],
      picnicReplyShare: [['him', 'Kita kongsi? Okay. Separuh untuk awak, separuh untuk saya… tapi separuh awak lagi besar.']],
      picnicReplyFeed: [['him', 'Sini, saya suapkan. Aaa~ … Manis tak? Saya tahu. Sebab awak yang makan.']],
      picnicEnd: [['him', 'Bila-bila awak nak rehat, gazebo ni sentiasa ada. Saya pun.']],
      // ---- Birthday cake in the Secret Room
      cakeReveal: [
        ['him', 'Princess {HER_NAME}... perjalanan awak dalam kerajaan kecil ni dah sampai ke penghujung.'],
        ['him', 'Tapi saya masih ada satu perkara yang paling penting untuk kita raikan.'],
        ['him', 'Happy Birthday, my princess.'],
        ['him', 'Semoga setiap impian awak menjadi kenyataan. Saya doakan awak sentiasa bahagia, bukan hari ini sahaja, tapi setiap hari.'],
        ['him', 'Now close your eyes, make a wish, and blow your candles.'],
      ],
      afterCandles: [
        ['him', 'Yeay! Selamat hari lahir, sayang! Tengok luar tingkap tu — langit pun meraikan awak.'],
        ['him', 'Surat atas meja tu… untuk awak. Bacalah perlahan-lahan.'],
      ],
    } satisfies Record<string, readonly ScriptLine[]>,

    // ======================================================================
    // CHILDREN'S WONDERLAND
    // ======================================================================
    children: {
      momoIntro: [
        ['momo', 'Huhu… huhu… *teresak*'],
        ['her', 'Eh, kenapa ni sayang? Kenapa menangis?'],
        ['momo', 'Bintang… Bintang plush Momo hilang… Momo main tadi, lepas tu angin tiup kuat sangat… 😢'],
        ['her', 'Jangan risau, Momo. Kakak tolong carikan ya.'],
        ['momo', 'Betul ke?! Kakak Princess baik sangat!'],
        ['him', 'Tengok tu, budak-budak terus sayang awak. Jom kita cari petunjuk dekat taman permainan ni.'],
      ],
      momoWaiting: [['momo', 'Kakak dah jumpa Bintang Momo? Momo tunggu sini tau…']],
      momoNeedsClues: [['momo', 'Angin tiup ke arah buaian… lepas tu Momo tak nampak dah.']],
      momoReturn: [
        ['her', 'Momo, tengok apa kakak jumpa!'],
        ['momo', 'BINTANG!!! Bintang Momo dah balik! Terima kasih kakak Princess! 💖'],
        ['momo', 'Nah, Momo bagi lencana ni. Lencana untuk orang yang paling baik hati!'],
      ],
      momoAfter: [['momo', 'Momo sayang kakak Princess! Datang main lagi tau!']],
      clue_sandbox: 'Ada kesan tapak kaki kecil Momo di dalam pasir… dan seutas benang reben berkilau, terbang ke arah buaian.',
      clue_swing: 'Pada rantai buaian tersangkut sehelai reben bintang. Angin dari sini bertiup ke arah pokok besar di barat daya taman.',
      clue_story: 'Cik Arnab berbisik: "Masa angin kuat tadi, Arnab nampak sesuatu berkilau melayang… dan masuk ke dalam lubang pokok tua!"',
      tree_noClues: 'Pokok tua ni ada lubang besar… tapi gelap sangat. Mungkin cari petunjuk lain dulu?',
      tree_found: 'Dalam lubang pokok tua, ada sesuatu berkilau… Bintang plush Momo! Bersih dan selamat.',
      ball: ['Bola melantun jauh! Hehe.', 'Gol! Princess memang ada bakat.', 'Boing! Bola tu suka awak.'],
      xylophone: ['Do-re-mi~ ♪', 'Melodi comel bergema di taman.', '♪ Ting-ting-ting ♪'],
    },

    // ======================================================================
    // STORM
    // ======================================================================
    storm: {
      brewing: [['him', 'Eh… langit makin gelap. Sayang, rapat sikit dengan saya.']],
      separated: [
        ['narrator', 'Kabus tebal tiba-tiba menyelubungi hutan. Angin bertiup kencang…'],
        ['narrator', 'Bila kabus sedikit reda, dia sudah tiada di sisi awak.'],
      ],
      calls: [
        'Sayang? Awak kat mana? Saya kat sini!',
        'Ikut cahaya, sayang… saya tunggu!',
        'Jangan takut, saya dekat je ni!',
        'Sayang, saya tak ke mana-mana. Cari saya ya?',
      ],
      clues: {
        storm_umbrella: 'Sebuah payung merah jambu. Ia boleh melindungi awak daripada hujan… tetapi bukan daripada rasa takut.',
        storm_lantern: 'Tanglung ajaib menyala lembut. Cahayanya condong ke arah barat — seolah-olah menunjukkan jalan kepada seseorang.',
        storm_shelter: 'Sebuah pondok kecil. Ia kering dan tenang… tapi entah kenapa, ia terasa kosong tanpa seseorang di sisi.',
        storm_crystal: 'Kristal bercahaya berbisik: "Tempat paling selamat bukan dibina daripada kayu atau batu…"',
      },
    },

    // ======================================================================
    // COURTROOM — Kes Kek Hari Jadi Yang Hilang
    // ======================================================================
    courtroom: {
      caseTitle: 'Kes Kek Hari Jadi Yang Hilang',
      caseIntro:
        'Kek hari jadi diraja hilang dari dapur istana petang semalam. Encik Arnab, pembantu tukang roti, dituduh mencurinya kerana dia orang terakhir yang dilihat di dapur.',
      judgeIntro: [
        ['judge', 'Hoo-hoo! Mahkamah dibuka. Kes Kek Hari Jadi Yang Hilang.'],
        ['judge', 'Puan Peguam, sila periksa semua bukti sebelum membuat keputusan. Keadilan memerlukan kesabaran.'],
      ],
      needClues: [['judge', 'Hoo… masih ada bukti yang belum diperiksa. Seorang peguam yang baik meneliti semuanya dahulu.']],
      clues: {
        clue_footprints: {
          title: 'Bukti A: Kesan Tapak',
          text: 'Kesan tapak di lantai dapur berbentuk kuku belah — bukan tapak kaki arnab. Ada serbuk kek dan sehelai bulu putih kerinting di sebelahnya.',
        },
        clue_witness: {
          title: 'Bukti B: Kenyataan Saksi',
          text: 'Tukang kebun bersumpah dia nampak Encik Arnab di pasar membeli tepung pada jam 3 petang — waktu kek hilang.',
        },
        clue_log: {
          title: 'Bukti C: Buku Log Dapur',
          text: '"3:05 petang — Tingkap dapur dibiarkan terbuka. Kambing Comel dari ladang diraja dilihat berkeliaran berhampiran tingkap."',
        },
      },
      q1: {
        question: 'Berdasarkan bukti, siapakah yang mengambil kek itu?',
        options: [
          { id: 'arnab', label: 'Encik Arnab — dia orang terakhir di dapur', correct: false, feedback: 'Hmm… tapi saksi nampak Encik Arnab di pasar pada waktu kejadian, dan tapaknya bukan tapak arnab. Cuba lihat bukti semula.' },
          { id: 'kambing', label: 'Kambing Comel — masuk melalui tingkap terbuka', correct: true, feedback: 'Tepat! Tapak kuku belah, bulu kerinting dan log tingkap terbuka semuanya menunjuk kepada Kambing Comel.' },
          { id: 'kebun', label: 'Tukang kebun — dia yang memberi kenyataan', correct: false, feedback: 'Tiada bukti yang mengaitkan tukang kebun. Menuduh tanpa bukti tidak adil, Puan Peguam.' },
        ],
      },
      q2: {
        question: 'Apakah keputusan yang paling adil?',
        options: [
          { id: 'harsh', label: 'Hukum berat Kambing Comel supaya serik', correct: false, feedback: 'Kambing Comel cuma lapar dan tidak faham. Keadilan bukan tentang menghukum seberat-beratnya.' },
          { id: 'fair', label: 'Bebaskan Encik Arnab, tutup tingkap dapur, dan sediakan makanan untuk Kambing Comel', correct: true, feedback: 'Keputusan yang bijaksana! Yang tidak bersalah dibebaskan, punca masalah diselesaikan, dan semua dilayan dengan belas kasihan.' },
          { id: 'everyone', label: 'Denda semua orang yang ada di istana', correct: false, feedback: 'Menghukum semua orang bermakna menghukum yang tidak bersalah. Cuba lagi.' },
        ],
      },
      verdictJudge: [
        ['judge', 'Hoo-hoo! Mahkamah bersetuju sepenuhnya dengan Puan Peguam.'],
        ['judge', 'Encik Arnab dibebaskan. Tingkap dapur akan ditutup. Dan Kambing Comel… akan dapat kek kecilnya sendiri.'],
        ['judge', 'Kes ditutup! Tahniah atas hujah yang adil dan penuh belas kasihan.'],
      ],
    },

    // ======================================================================
    // SMALL OBJECT INTERACTIONS
    // ======================================================================
    objects: {
      lipstick: ['Gincu warna rose nude. Tak payah pakai pun dah cantik, tapi kalau pakai… habislah saya. 😳', 'Warna ni sesuai sangat dengan awak.'],
      perfume: ['Bau mawar dan vanila… macam bau hari bahagia.', 'Saya selalu ingat bau wangi awak. Serius.'],
      throne: ['Tuan Puteri bersemayam di singgahsana! Patik menjunjung titah. 🙇', 'Sesuai sangat awak duduk situ. Macam memang dicipta untuk awak.'],
      musicBox: ['♪ Kotak muzik memainkan melodi lembut… ♪', 'Lagu ni saya pilih sebab ia mengingatkan saya pada senyuman awak.'],
      vase: ['Bunga pertama awak, segar dalam pasu diraja.', 'Bunga ni takkan layu dalam dunia ni. Macam sayang saya.'],
      wishFountain: ['Awak buat hajat apa tu? Rahsia ke? Hehe. Saya pun ada hajat — semoga hajat awak semua tercapai.', 'Air pancut ni simpan semua doa baik untuk awak.'],
      seedsGet: 'Awak dapat 3 Benih Ajaib! Tanam di petak tanah berhampiran.',
      seedsAlready: 'Bakul benih ni dah kosong — benih ajaib ada dengan awak.',
      canGet: 'Awak dapat Penyiram Emas! Siram benih yang dah ditanam.',
      plotNeedSeed: 'Petak tanah yang subur. Perlukan Benih Ajaib — ada dalam bakul dekat bangsal.',
      plotPlanted: 'Benih ditanam! Sekarang perlukan air…',
      plotNeedWater: 'Benih ni dahaga. Perlukan Penyiram Emas — dekat air pancut taman.',
      lookoutReplay: 'Nak tengok bunga api sekali lagi?',
      castleDoorLocked: 'Pintu istana masih tertutup…',
      secretDoorLocked: 'Sebuah pintu misteri, berukir bunga dan bintang. Terkunci rapat… seolah-olah menunggu masa yang sesuai.',
      giftAlready: 'Hadiah istimewa awak. 🎁',
      strawberryNotYet: 'Strawberry ni belum masak sepenuhnya. Cari yang merah ranum dan bersinar.',
      picnicLocked: 'Gazebo yang cantik… Kutip lima strawberry ranum dulu, nanti kita berkelah di sini.',
      cakeAfter: ['Kek ni cantik kan? Macam awak. Manis pun macam awak.', 'Lilin dah padam, tapi hajat awak tetap menyala. 🤍'],
    },

    // ======================================================================
    // GATES (when she walks into a locked barrier)
    // ======================================================================
    gates: {
      castleGate: 'Gerbang istana dikunci oleh sihir lembut. Mungkin… selepas menerima hadiah pertama?',
      world: 'Pagar mawar ajaib masih tertutup. Ia akan terbuka selepas awak baca sesuatu yang penting di istana.',
      hillBridge: 'Jambatan ke Bukit Bunga Api masih dikunci cahaya bintang. Selesaikan semua pengembaraan dulu.',
    },

    // ======================================================================
    // CONTEXTUAL IDLE COMMENTS ("barks")
    // ======================================================================
    barks: {
      courtyard: ['Dataran ni saya hias khas untuk hari awak.', 'Awak jalan pun nampak macam puteri betul. Eh, memang puteri pun.'],
      castleGrounds: ['Air pancut tu cantik, tapi awak lagi cantik. Sorry, terkeluar.', 'Istana awak ni, sayang. Selamanya.'],
      garden: [
        'Tengok mawar tu… merah jambu, macam pipi awak bila malu.',
        'Bunga matahari tu asyik pandang awak. Saya faham perasaan dia.',
        'Awak suka tulip ke mawar? Saya suka… awak. Hehe.',
        'Bau taman ni wangi. Tapi bau awak lagi saya ingat.',
        'Kalau awak jadi bunga, saya nak jadi tukang kebun. Supaya boleh jaga awak hari-hari.',
      ],
      mirror: ['Cermin tu bertuah sebab dapat tengok awak lama-lama.', 'Awak tak payah touch-up pun dah cantik, tau tak?'],
      library: [
        'Awak baca, saya tunggu sini. Saya suka tengok awak khusyuk baca.',
        'Kalau awak hilang dalam buku, saya tunggu sampai awak jumpa jalan balik.',
        'Senyap-senyap, perpustakaan… tapi hati saya bising bila dekat awak.',
      ],
      courtroom: ['Bakal Puan Peguam dah sampai! Semua bangun, hormat!', 'Awak nampak serius bila fikir. Comel.'],
      children: ['Comelnya makhluk-makhluk kecil ni. Tapi awak lagi comel.', 'Budak-budak memang suka awak, kan? Saya tak hairan.'],
      storm: ['Rapat dengan saya, sayang. Saya ada.', 'Petir tu bising je, dia tak boleh buat apa-apa kat awak.'],
      fireworks: ['Cantik kan langit malam ni?', 'Saya nak ingat malam ni selama-lamanya.'],
      paths: ['Jalan perlahan-lahan pun tak apa. Saya suka jalan dengan awak.', 'Penat tak, sayang? Nak berhenti kejap?', 'Kalau awak sesat, ikut je saya. Eh, saya pun ikut awak.'],
      castleHall: ['Ni rumah awak, sayang. Rehatlah dulu kalau penat.', 'Dewan ni besar, tapi rasa penuh bila awak ada.'],
      bedroom: ['Bilik tidur puteri. Saya pilih warna lembut sebab nak awak tidur lena.'],
      secretRoom: ['Bilik ni… untuk kita berdua je.'],
      strawberryGarden: ['Merahnya strawberry tu… tapi pipi awak lagi merah bila malu.', 'Hijau sage ni warna kegemaran awak, kan? Saya ingat.', 'Kalau penat, kita rehat dekat gazebo tu nanti.'],
    } satisfies Partial<Record<LocationId, string[]>>,

    /** First time she enters a location. */
    arrivals: {
      garden: 'Selamat datang ke Taman Impian! Kutip bunga, tanam benih, dan… ada nota rahsia yang saya sorok. Cari tau!',
      mirror: 'Bilik Cermin Diraja. Cuba tanya cermin besar tu satu soalan…',
      library: 'Perpustakaan Impian. Ada empat buku bercahaya — saya tulis semuanya untuk awak.',
      courtroom: 'Mahkamah Diraja! Ada kes yang perlukan peguam bijak. Saya kenal sorang… awak la tu.',
      children: 'Taman Kanak-kanak! Eh, ada makhluk kecil menangis kat sana tu…',
      storm: 'Hutan ni… nampak lain sikit. Sayang, jangan jauh dari saya ya.',
      fireworks: 'Bukit Bunga Api. Naik sampai ke puncak, sayang.',
      castleGrounds: 'Ni halaman istana awak. Cantik tak?',
      strawberryGarden: 'Taman Strawberry! Sudut kecil ni saya tanam khas untuk awak.',
    } satisfies Partial<Record<LocationId, string>>,

    /** He speaks when she sits for a while and he takes a seat. */
    sitLines: ['Saya duduk sini kejap ya. Teman awak.', 'Rehat dulu, sayang. Tak payah rush.', 'Best kan duduk diam-diam macam ni?'],
    recoveryLines: ['Tunggu saya, sayang! Hehe, laju betul awak jalan.', 'Eh, saya tertinggal! Tunggu~', 'Fuh, sempat jugak kejar.'],

    // ======================================================================
    // "TALK TO HIM" — conversation topics for the local dialogue engine
    // ======================================================================
    talk: {
      firstEver: 'Eh, nak borak dengan saya? Suka! Tanya je apa-apa.',
      greetings: [
        'Ya, sayang? Saya dengar.',
        'Hm? Rindu saya ke? Hehe.',
        'Panggil saya? Saya memang dah tunggu.',
        'Ada apa, tuan puteri? Patik sedia berkhidmat.',
        'Hai cantik. Eh, maksud saya — hai sayang.',
      ],
      greetingsRepeat: [
        'Baru je tadi borak, dah rindu lagi? Saya pun sama.',
        'Awak ni suka sangat borak dengan saya kan. Saya tak kisah, saya suka.',
        'Lagi? Okay! Saya tak pernah bosan dengan awak.',
      ],
      greetingByLocation: {
        library: 'Shh… kita dalam perpustakaan. *bisik* Ya sayang?',
        storm: 'Saya ada sini, sayang. Pegang tangan saya kalau takut.',
        fireworks: 'Hm? Nak cakap apa, sambil tengok langit?',
        secretRoom: 'Ya, sayang… bilik ni untuk kita.',
      } satisfies Partial<Record<LocationId, string>>,
      choices: {
        hint: 'Apa kita patut buat sekarang?',
        place: 'Cerita pasal tempat ni',
        manja: 'Manja sikit 🥺',
        memory: 'Ingat tak…?',
        chat: 'Sembang bebas',
        bye: 'Okay, jom!',
      },
      hintPrefix: ['Hmm, rasanya…', 'Kalau saya jadi awak…', 'Cadangan saya:'],
      allDone: 'Semua dah siap, sayang. Sekarang kita boleh jalan-jalan je. Saya suka.',
      place: {
        courtyard: ['Dataran Pertabalan. Kat sini awak ditabalkan jadi Princess. Hari bersejarah!'],
        castleGrounds: ['Halaman istana. Air pancut tu saya letak sebab bunyi air menenangkan.', 'Menara-menara tu warna pink dan ivory. Ikut citarasa awak.'],
        garden: ['Taman ni ada mawar merah jambu, mawar putih, tulip, bunga matahari, hydrangea dan sakura. Semua kegemaran awak.', 'Bangku tu — satu hari nanti kita duduk sana lama-lama ya.'],
        mirror: ['Bilik solek diraja. Gincu, minyak wangi, berus… semua untuk awak. Walaupun awak tak perlukan pun.'],
        library: ['Perpustakaan ni untuk ulat buku kesayangan saya. Buku terapung tu — magic, jangan tanya macam mana. Hehe.'],
        courtroom: ['Mahkamah ni untuk bakal peguam. Satu hari nanti, awak akan berdiri di mahkamah betul. Saya yakin.'],
        children: ['Taman kanak-kanak. Saya tahu awak sayang budak-budak. Hati awak memang lembut.'],
        storm: ['Hutan ni gelap sikit. Tapi selagi saya ada, tak ada apa yang perlu ditakutkan.'],
        fireworks: ['Bukit ni menghadap seluruh kerajaan. Dari sini, semua yang kita lalui nampak kecil… kecuali awak.'],
        paths: ['Laluan diraja. Setiap jalan dalam dunia ni akhirnya bawa balik ke awak.'],
        castleHall: ['Dewan Besar. Singgahsana tu untuk awak. Cubalah duduk!', 'Kotak muzik dekat sana tu — cuba main.'],
        bedroom: ['Bilik tidur awak. Katil tu empuk, saya dah test. Eh, sikit je.'],
        secretRoom: ['Bilik rahsia. Saya bina paling akhir, tapi rancang paling awal.'],
        strawberryGarden: ['Taman Strawberry, dengan gazebo hijau sage. Warna kegemaran awak, dan buah kegemaran awak.'],
      } satisfies Partial<Record<LocationId, string[]>>,
      manja: [
        'Sayang… pandang saya kejap. Okay, dah. Saya cuma nak tengok muka awak.',
        'Awak tahu tak, awak ni punca saya senyum sorang-sorang macam orang gila?',
        'Kalau awak penat, sandar kat bahu saya. Free, tak payah bayar.',
        'Saya clingy sikit hari ni. Sebab hari jadi awak. Esok pun clingy jugak. Lusa pun.',
        'Jangan jauh-jauh tau. Nanti saya rindu.',
        'Awak comel sangat sampai saya lupa nak cakap apa tadi.',
        'Kalau sayang saya ada bar, dah lama penuh. Dah overflow.',
        'Nak dengar rahsia? Saya sayang awak. Okay, bukan rahsia pun.',
        'Hari ni awak dah makan? Minum air? Jangan lupa jaga diri, princess saya.',
        'Saya tak pandai bermadah, tapi saya pandai sayang awak.',
      ],
      noMoreMemories: 'Kenangan yang paling saya nak? Yang kita akan cipta lepas ni. Sama-sama.',
      goodbye: ['Okay, jom! Saya ikut belakang.', 'Lead the way, princess!', 'Jom! Jangan laju sangat, nanti saya tertinggal. Hehe.'],
      reactions: {
        garden: 'Taman tu dah mekar sebab awak. Saya tak pernah tengok bunga secantik tu.',
        mirror: 'Lepas cermin tu cakap benda betul, saya rasa nak bagi dia anugerah.',
        library: 'Buku-buku tu… saya harap awak suka. Saya tulis dengan sepenuh hati.',
        courtroom: 'Saya masih terfikir hujah awak kat mahkamah tadi. Bijak gila!',
        children: 'Momo asyik cerita pasal kakak Princess. Awak dah ada peminat setia.',
        storm: 'Ribut tadi… awak okay? Saya ada je. Sentiasa.',
        finale: 'Malam tadi… bunga api tu… saya takkan lupa.',
      } satisfies Partial<Record<QuestId, string>>,
    },

    // ======================================================================
    // FREE CHAT — keyword responder used when no AI proxy is configured
    // ======================================================================
    freeChat: {
      intro: 'Taip apa-apa je, sayang. Saya dengar.',
      rules: [
        { match: ['sayang', 'love', 'cinta', 'luv'], replies: ['Saya sayang awak lagi. Lagi banyak. Tak boleh lawan.', 'Love you too, princess. Selamanya.'] },
        { match: ['rindu', 'miss'], replies: ['Saya pun rindu awak. Padahal awak ada depan mata.', 'Rindu tu tanda sayang. Jadi saya sayang awak banyak gila.'] },
        { match: ['takut', 'scared', 'risau', 'cemas'], replies: ['Tak apa, ada saya. Kita hadap sama-sama.', 'Tarik nafas dalam-dalam. Saya kat sini, tak ke mana.'] },
        { match: ['penat', 'letih', 'tired', 'stress'], replies: ['Rehat dulu, sayang. Awak dah buat yang terbaik.', 'Penat tu tanda awak berusaha. Saya bangga dengan awak.'] },
        { match: ['lapar', 'makan', 'hungry'], replies: ['Jom makan! Saya belanja. Dalam dunia ni semua free, hehe.', 'Awak dah makan belum? Jangan skip makan tau.'] },
        { match: ['peguam', 'law', 'lawyer', 'exam', 'study', 'belajar'], replies: ['Awak akan jadi peguam yang hebat. Saya yakin 100%.', 'Belajar elok-elok. Bila penat, ingat ada orang yang paling bangga dengan awak.'] },
        { match: ['cantik', 'lawa', 'pretty', 'beautiful'], replies: ['Awak? Cantik. Itu fakta, bukan pendapat.', 'Cermin pun setuju dengan saya. Awak paling cantik.'] },
        { match: ['terima kasih', 'thank', 'tq'], replies: ['Sama-sama, sayang. Semua ni untuk awak.', 'Tak payah terima kasih. Senyuman awak dah cukup.'] },
        { match: ['bunga', 'flower'], replies: ['Kalau boleh, saya nak bagi awak satu taman penuh dengan bunga. Eh, dah bagi pun!'] },
        { match: ['buku', 'book', 'baca'], replies: ['Ulat buku kesayangan saya. Nanti kita pergi kedai buku sama-sama ya.'] },
        { match: ['marah', 'merajuk', 'sedih', 'sad'], replies: ['Alololo… sini, cerita kat saya. Saya dengar.', 'Kalau saya buat salah, sorry ya sayang. Saya nak awak happy.'] },
        { match: ['hari jadi', 'birthday', 'besday'], replies: ['Selamat hari lahir, sayang! Semoga panjang umur, murah rezeki, dan sentiasa bahagia.'] },
        { match: ['assalamualaikum', 'salam'], replies: ['Waalaikumussalam, sayang. 🤍'] },
        { match: ['hai', 'hi', 'hello', 'helo'], replies: ['Hai cantik! Ada apa?', 'Hello princess! Rindu ke?'] },
        { match: ['kahwin', 'nikah', 'marry'], replies: ['Hehe… insyaAllah. Doakan yang terbaik untuk kita ya.'] },
        { match: ['budak', 'kanak', 'kids', 'children'], replies: ['Awak memang pandai dengan budak-budak. Hati awak lembut sangat.'] },
        // ---- Added with the Gemini upgrade: more topics for the offline replies.
        // `andAny`: the rule only applies when one of these words is ALSO in her message.
        { match: ['tengah buat', 'sedang buat', 'awak buat apa', 'buat apa tu', 'what are you doing', 'what r u doing', 'wyd', 'doing what'], replies: ['Tengah jalan sebelah awak la, sayang. Kerja paling best dalam dunia ni.', 'Tengah teman tuan puteri jelajah kerajaan dia. Awak pula, nak pergi mana lepas ni?'] },
        { match: ['rindu', 'miss'], andAny: ['mak', 'ibu', 'ayah', 'abah', 'mama', 'papa', 'umi', 'abi', 'keluarga', 'family', 'adik', 'kakak', 'abang', 'nenek', 'atuk'], replies: ['Mesti awak rindu sangat dengan mereka, kan… Nanti call atau jumpa mereka ya. Saya doakan mereka sentiasa sihat.', 'Rindu keluarga tu tanda hati awak penuh kasih sayang. Peluk mereka bila jumpa nanti, ya.'] },
        { match: ['apa khabar', 'how are you', 'sihat tak', 'okay tak', 'ok tak'], replies: ['Saya sihat, alhamdulillah — lagi-lagi bila awak ada. Awak pula macam mana hari ni?', 'Baik je, sayang. Awak okay tak? Cerita sikit pasal hari awak.'] },
        { match: ['sakit', 'demam', 'pening', 'sick', 'headache', 'migraine', 'selsema'], replies: ['Alamak… rehat cukup-cukup ya, sayang. Minum air banyak, dan kalau tak okay, jumpa doktor tau.', 'Kesian princess saya. Jangan paksa diri hari ni, ya. Rehat dulu.'] },
        { match: ['ngantuk', 'mengantuk', 'nak tidur', 'good night', 'goodnight', 'selamat malam', 'sleepy'], replies: ['Tidurlah, sayang. Mimpi indah… kalau boleh, mimpikan saya sikit. Hehe.', 'Selamat malam, princess. Rehat elok-elok, esok kita sambung lagi.'] },
        { match: ['bosan', 'boring', 'bored'], replies: ['Bosan? Jom jelajah! Ada banyak lagi kejutan yang saya sorok dalam dunia ni.', 'Kalau bosan, cuba buka Jurnal — mesti ada misi yang belum siap. Saya teman.'] },
        { match: ['maaf', 'sorry', 'sori'], replies: ['Tak apa, sayang. Saya tak pernah marah lama-lama dengan awak.', 'Dah, dah. Saya dah maafkan sebelum awak habis taip pun.'] },
        { match: ['awak ai', 'are you ai', 'are you real', 'betul ke awak', 'awak real', 'ni bot', 'chatbot', 'robot'], replies: ['Saya Fareed versi dalam game ni — Fareed yang sebenar bina saya untuk teman awak. Kalau nak cakap dengan dia betul-betul, mesej dia terus ya. 🤍'] },
      ],
      fallback: [
        'Hmm, saya tak berapa faham, tapi saya suka dengar suara awak. Eh, tulisan awak.',
        'Betul tu sayang. Apa-apa pun, saya setuju dengan awak. Hehe.',
        'Cerita lagi, saya suka dengar.',
        'Awak ni ada-ada je. Comel.',
      ],
      aiUnavailable: '(Sambungan AI tak dapat dicapai — saya guna hati sendiri je ya.)',
      /**
       * Words she uses to CALL him ("Sayang, saya lapar") rather than a topic.
       * They count less, so the real topic of her message wins.
       */
      addressWords: ['sayang', 'love', 'luv', 'princess', 'baby', 'dear'],
    },
  },

  // ==========================================================================
  // 7. MISI — quest titles, descriptions, objectives and hints
  // ==========================================================================
  quests: {
    coronation: {
      chapter: 'Bab 1',
      name: 'Pertabalan Diraja',
      description: 'Sebuah mahkota menanti di atas kusyen baldu. Setiap puteri layak diraikan.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        crown: 'Hampiri mahkota & terima mahkota anda',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Mahkota awak ada di atas kusyen baldu di tengah dataran tu.',
    },
    bouquet: {
      chapter: 'Bab 2',
      name: 'Hadiah Pertama',
      description: 'Sejambak bunga istimewa sedang menunggu di paparan bunga.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        bouquet: 'Terima jambangan bunga anda',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Ada sesuatu untuk awak di paparan bunga sebelah kanan dataran.',
    },
    castle: {
      chapter: 'Bab 3',
      name: 'Istana Rahsia Diraja',
      description: 'Gerbang ajaib telah terbuka. Sebuah istana menanti tuannya.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        reveal: 'Saksikan gerbang istana terbuka',
        enter: 'Masuk ke dalam istana anda',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Istana awak di utara, sayang. Lalu gerbang emas tu.',
    },
    letter: {
      chapter: 'Bab 4',
      name: 'Surat Cinta',
      description: 'Di bilik tidur puteri, sepucuk sampul bermeterai menanti di meja sisi katil.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        read: 'Buka sampul di meja sisi katil',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Cuba tengok bilik tidur awak. Sebelah kanan dewan besar.',
    },
    garden: {
      chapter: 'Pengembaraan',
      name: 'Taman Impian',
      description: 'Taman yang luas penuh bunga kegemaran awak — kutip, tanam, siram, dan temui rahsianya.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        flowers: 'Kutip bunga ajaib',
        bloom: 'Tanam & siram benih ajaib',
        notes: 'Cari nota tersembunyi',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Taman bunga di timur. Ambil benih dekat bangsal, dan penyiram dekat air pancut.',
    },
    mirror: {
      chapter: 'Pengembaraan',
      name: 'Cermin Ajaib',
      description: 'Di bilik solek diraja, ada sebuah cermin yang hanya bercakap benar.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        ask: 'Bertanya kepada cermin ajaib',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Bilik Cermin di timur laut, utara taman bunga.',
    },
    library: {
      chapter: 'Pengembaraan',
      name: 'Perpustakaan Impian',
      description: 'Empat buku bercahaya menyimpan kisah yang ditulis khas untuk awak.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        books: 'Baca buku-buku bercahaya',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Perpustakaan di barat laut. Ada empat buku yang bercahaya.',
    },
    courtroom: {
      chapter: 'Pengembaraan',
      name: 'Peguam Masa Depan',
      description: 'Kes Kek Hari Jadi Yang Hilang memerlukan seorang peguam yang bijak dan adil.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        clues: 'Periksa bukti di mahkamah',
        verdict: 'Buat keputusan yang adil di meja hakim',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Mahkamah di barat dataran. Periksa semua bukti dulu sebelum buat keputusan.',
    },
    children: {
      chapter: 'Pengembaraan',
      name: 'Mainan Momo Yang Hilang',
      description: 'Momo, makhluk kecil yang comel, kehilangan mainan kesayangannya.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        talk: 'Bercakap dengan Momo',
        clues: 'Cari petunjuk di taman permainan',
        find: 'Temui mainan Momo',
        return: 'Pulangkan mainan kepada Momo',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Taman Kanak-kanak di tenggara. Momo nampak sedih tu…',
    },
    storm: {
      chapter: 'Pengembaraan',
      name: 'Finding My Shelter',
      description: 'Hutan di barat daya diselubungi ribut. Cari tempat yang ribut tak mampu menakutkan awak.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        enter: 'Masuk ke Hutan Ribut',
        clues: 'Periksa petunjuk dalam hutan',
        found: 'Find a place where the storm cannot frighten you',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Hutan di barat daya. Jangan risau, kalau hujan… saya ada.',
    },
    finale: {
      chapter: 'Kemuncak',
      name: 'Bukit Bunga Api',
      description: 'Di atas bukit yang menghadap seluruh kerajaan, langit malam sedang menunggu.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        watch: 'Naik ke puncak Bukit Bunga Api',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Jom ke bukit di selatan, seberang jambatan. Saya ada kejutan.',
    },
    secret: {
      chapter: 'Penutup',
      name: 'Bilik Rahsia',
      description: 'Sebuah pintu misteri di dalam istana kini terbuka.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        enter: 'Masuk ke Bilik Rahsia di istana',
        candles: 'Buat hajat & tiup lilin kek hari jadi',
        read: 'Buka surat terakhir',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Balik ke istana, sayang. Pintu sebelah kiri dewan dah terbuka.',
    },
    memories: {
      chapter: 'Pilihan',
      name: 'Bintang Kenangan',
      description: 'Lapan bintang kecil tersembunyi di seluruh kerajaan. Setiap satu menyimpan kenangan kita.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        stars: 'Kumpul Bintang Kenangan',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Ada bintang-bintang kecil bersinar tersembunyi merata tempat. Cari tau!',
    },
    strawberries: {
      chapter: 'Pilihan',
      name: 'The Sweetest Little Harvest',
      description: 'Di Taman Strawberry, lima biji strawberry merah ranum menanti tangan Princess untuk dikutip.',
      /** One line per objective (shown in the Quest Journal). */
      objectives: {
        pick: 'Find 5 ripe strawberries',
      },
      /** Short hint used by Prince Fareed and the objective tracker. */
      hint: 'Taman Strawberry di timur laut Taman Impian — ikut laluan kecil dekat bangsal, ke gazebo hijau.',
    },
  } satisfies Record<QuestId, QuestText>,

  // ==========================================================================
  // 8. BARANG — item names & descriptions (inventory)
  // ==========================================================================
  items: {
    crown: { name: 'Mahkota Rose-Gold', description: 'Mahkota diraja bertatah permata merah jambu dan kristal. Milik Princess seorang sahaja.' },
    bouquet: { name: 'Jambangan Bunga Pertama', description: 'Mawar merah jambu, tulip putih dan bunga-bunga kecil berbalut reben.' },
    castleKey: { name: 'Kunci Istana Diraja', description: 'Istana ini milik awak. Selamanya.' },
    loveLetter: { name: 'Surat Cinta', description: 'Sepucuk surat dari seseorang yang sayang awak sepenuh hati.' },
    seeds: { name: 'Benih Ajaib', description: 'Tanam di petak tanah taman, kemudian siram.' },
    wateringCan: { name: 'Penyiram Emas', description: 'Untuk menyiram benih ajaib yang telah ditanam.' },
    roseCharm: { name: 'Azimat Mawar', description: 'Ganjaran Taman Impian. Harum seperti hari yang bahagia.' },
    pearlMirror: { name: 'Cermin Mutiara', description: 'Cermin kecil yang sentiasa mengingatkan awak betapa cantiknya awak.' },
    starBookmark: { name: 'Penanda Buku Bintang', description: 'Untuk setiap buku yang akan awak baca selepas ini.' },
    justiceBadge: { name: 'Lencana Peguam Masa Depan', description: 'Dianugerahkan kepada bakal peguam yang bijak dan adil.' },
    momoToy: { name: 'Bintang Plush Momo', description: 'Mainan kesayangan Momo. Perlu dipulangkan!' },
    kindnessBadge: { name: 'Lencana Hati Baik', description: 'Untuk hati yang sabar dan lembut dengan kanak-kanak.' },
    rainbowCrystal: { name: 'Kristal Pelangi', description: 'Selepas ribut, sentiasa ada pelangi. Dan sentiasa ada saya.' },
    starlightLocket: { name: 'Loket Cahaya Bintang', description: 'Menyimpan cahaya bunga api malam hari lahir awak.' },
    finalLetter: { name: 'Surat Terakhir', description: 'Surat dari Bilik Rahsia.' },
    strawberry: { name: 'Strawberry Ranum', description: 'Merah, manis dan dikutip sendiri oleh Princess di Taman Strawberry.' },
    strawberryBasket: { name: 'Bakul Strawberry', description: 'Bakul kayu kecil penuh strawberry — dibawa ke piknik di gazebo hijau.' },
  } satisfies Record<ItemId, { name: string; description: string }>,

  // ==========================================================================
  // 9. LOKASI — location names (Malay + English) & short descriptions
  // ==========================================================================
  locations: {
    courtyard: { name: 'Dataran Pertabalan', english: 'Coronation Courtyard', description: 'Tempat awak ditabalkan sebagai Princess.' },
    castleGrounds: { name: 'Istana Diraja', english: 'Royal Castle', description: 'Rumah awak. Selamanya.' },
    castleHall: { name: 'Dewan Besar', english: 'Grand Hall', description: 'Singgahsana, kotak muzik dan jambangan pertama awak.' },
    bedroom: { name: 'Kamar Puteri', english: "Princess's Bedroom", description: 'Bilik tidur yang lembut dan tenang.' },
    secretRoom: { name: 'Bilik Rahsia', english: 'The Secret Room', description: 'Kejutan terakhir.' },
    garden: { name: 'Taman Impian', english: 'Garden of Her Dreams', description: 'Mawar, tulip, bunga matahari, hydrangea dan sakura.' },
    mirror: { name: 'Bilik Cermin Ajaib', english: 'Magical Mirror Room', description: 'Cermin yang hanya bercakap benar.' },
    library: { name: 'Perpustakaan Impian', english: 'Dream Library', description: 'Empat buku bercahaya untuk awak.' },
    courtroom: { name: 'Mahkamah Diraja', english: 'Future Lawyer Courtroom', description: 'Kes Kek Hari Jadi Yang Hilang.' },
    children: { name: 'Taman Kanak-kanak', english: "Children's Wonderland", description: 'Momo perlukan bantuan awak.' },
    storm: { name: 'Hutan Ribut', english: 'Stormy Forest', description: 'Finding My Shelter.' },
    fireworks: { name: 'Bukit Bunga Api', english: 'Fireworks Celebration Hill', description: 'Malam yang meraikan kewujudan awak.' },
    strawberryGarden: { name: 'Taman Strawberry', english: 'Strawberry Garden', description: 'Batas strawberry ranum dan gazebo hijau sage untuk berkelah.' },
    paths: { name: 'Laluan Diraja', english: 'Royal Pathways', description: 'Jalan-jalan yang menghubungkan kerajaan.' },
  } satisfies Record<LocationId, { name: string; english: string; description: string }>,

  // ==========================================================================
  // 10. TEKS CERITA — banners, notifications ("toasts") and the action
  //     prompts shown next to objects ("Tekan E untuk …").
  //     {count}, {total}, {flower}, {title} are filled in by the game.
  // ==========================================================================
  story: {
    coronationLine: 'Every princess deserves to be celebrated.',
    bouquetLine: 'Untuk princess yang paling istimewa.',
    banners: {
      palaceUnlocked: { title: 'ROYAL PALACE UNLOCKED', subtitle: 'Your very own kingdom awaits, Princess.' },
      castleOwned: { title: 'Istana Diraja', subtitle: 'Mulai hari ini, istana ini milik awak.', button: 'Enter My Castle' },
      kingdomAwaits: { title: 'THE KINGDOM AWAITS', subtitle: 'Seluruh kerajaan kini terbuka untuk awak. Ikut penanda emas pada peta.' },
      /** The subtitle of this banner is storm.questPrompt (section 4). */
      storm: { title: 'FINDING MY SHELTER' },
      fireworksHill: { title: 'FIREWORKS CELEBRATION HILL', subtitle: 'Jambatan ke bukit telah terbuka. Jom ke selatan.' },
    },
    toasts: {
      castleWaiting: 'Istana menanti di utara. Masuk bila-bila masa awak sedia.',
      fireworksAgain: 'Bunga api untuk awak, sekali lagi. ✨',
      cakeWaiting: 'Kek hari jadi menanti — datang ke kek bila awak sedia untuk tiup lilin. 🎂',
      flowerPicked: '{flower} dikutip · {count}/{total}',
      bookRead: 'Buku dibaca · {count}/{total}',
      evidenceChecked: 'Bukti diperiksa · {count}/{total}',
      clueFound: 'Petunjuk ditemui · {count}/{total}',
      memoryStar: 'Bintang Kenangan · {count}/{total}',
      strawberryPicked: 'Strawberry dikutip · {count}/{total}',
      strawberryAlreadyPicked: 'Strawberry ini sudah dikutip.',
      strawberryQuest: 'The Sweetest Little Harvest — Find {total} ripe strawberries ({count}/{total})',
    },
    /** Short lines Prince Fareed says during the story. */
    barks: {
      allEvidence: 'Semua bukti dah ada. Jom ke meja hakim, Puan Peguam!',
      toyFound: 'Yay! Jom pulangkan pada Momo, sayang.',
      stormReunion: 'Sayang! Tunggu saya! Jangan risau, ribut tu tak ikut kita.',
    },
    /** Titles of the small note cards. */
    noteTitles: {
      bloom: 'Bunga Ajaib Mekar',
      clue: 'Petunjuk',
      found: 'Jumpa!',
      oldTree: 'Pokok Tua',
      secretDoor: 'Pintu Misteri',
    },
    flowerNames: {
      pinkRose: 'Mawar merah jambu',
      whiteRose: 'Mawar putih',
      tulip: 'Tulip',
      sunflower: 'Bunga matahari',
      hydrangea: 'Hydrangea',
      cherryBlossom: 'Bunga sakura',
    },
    flowerFallback: 'Bunga',
    /** Princess Sarah's choices at the strawberry picnic. */
    picnicChoices: {
      biggest: 'Yang paling besar & merah! 🍓',
      share: 'Kita kongsi, boleh?',
      feed: 'Awak suapkan saya',
    },
    /** Action prompts shown when she stands next to something. */
    actions: {
      crown: 'Accept My Crown',
      bouquet: 'Receive Your Flowers',
      enterCastle: 'Enter My Castle',
      exitCastle: 'Keluar ke halaman istana',
      openLetter: 'Buka sampul bermeterai',
      rereadLetter: 'Baca surat sekali lagi',
      pickFlower: 'Petik {flower}',
      takeSeeds: 'Ambil Benih Ajaib',
      seedBasketEmpty: 'Bakul benih (kosong)',
      takeWateringCan: 'Ambil Penyiram Emas',
      plantSeed: 'Tanam Benih Ajaib',
      waterSeed: 'Siram benih',
      wishFountain: 'Buat hajat di air pancut',
      hiddenNote: 'Ada sesuatu terselit di sini…',
      mirror: 'Bertanya kepada cermin',
      vanity: 'Meja solek diraja (tukar penampilan)',
      lipstick: 'Cuba gincu',
      perfume: 'Cium minyak wangi',
      readBook: 'Baca “{title}”',
      inspectEvidence: 'Periksa {title}',
      verdict: 'Buat keputusan di meja hakim',
      retrial: 'Ulang bicara kes',
      talkMomo: 'Bercakap dengan Momo',
      returnToy: 'Pulangkan mainan Momo',
      sandbox: 'Periksa kotak pasir',
      swing: 'Periksa buaian',
      storyBunny: 'Tanya Cik Arnab Pencerita',
      oldTree: 'Periksa lubang pokok tua',
      ball: 'Tendang bola',
      xylophone: 'Main xilofon',
      umbrella: 'Periksa payung',
      lantern: 'Periksa tanglung ajaib',
      shelter: 'Berteduh di pondok',
      crystal: 'Sentuh kristal bercahaya',
      fireworksAgain: 'Tengok bunga api sekali lagi',
      memoryStar: 'Bintang Kenangan',
      throne: 'Duduk di singgahsana',
      musicBox: 'Main kotak muzik',
      vase: 'Lihat jambangan bunga',
      secretDoor: 'Pintu misteri',
      openFinalLetter: 'Buka surat terakhir',
      rereadFinalLetter: 'Baca surat terakhir sekali lagi',
      openGift: 'Buka hadiah istimewa',
      cakeSurprise: 'Lihat kejutan di meja',
      cake: 'Lihat kek hari jadi',
      pickStrawberry: 'Kutip strawberry ranum 🍓',
      gazebo: 'Gazebo hijau sage',
      picnic: 'Duduk berkelah bersama',
      picnicAgain: 'Berkelah lagi di gazebo',
      talkToHim: 'Talk to him',
    },
  },

  // ==========================================================================
  // 11. TEKS SKRIN & BUTANG — title screen, HUD, menus, journal, map,
  //     inventory, settings, save & backup, pop-ups and error messages.
  // ==========================================================================
  ui: {
    titleScreen: {
      gameTitle: 'A World Made Just For Her',
      titleLine1: 'A World Made',
      titleLine2: 'Just For Her',
      subtitle: 'The Princess & Her Royal Companion',
      loading: 'Menyediakan kerajaan awak…',
      continue: 'Sambung pengembaraan',
      /** Followed by the date/time of the last save. */
      savedAt: 'Disimpan',
      newGame: 'Mula baharu',
      start: 'Mula',
      settings: 'Tetapan',
      soundHint: '🎧 Lebih indah dengan bunyi · Best with sound on',
      restoredFromBackup: 'Simpanan utama tidak dapat dibaca — kemajuan awak telah dipulihkan daripada salinan sandaran terakhir.',
      unreadableSave: 'Simpanan lama tidak dapat dibaca. Data itu disimpan berasingan untuk keselamatan, dan permainan bermula semula.',
      confirmNewGame: {
        title: 'Mula pengembaraan baharu?',
        body: 'Kemajuan yang disimpan dalam pelayar ini akan dipadam dan cerita bermula semula dari awal. Satu salinan sandaran disimpan dahulu — boleh dipulihkan di Tetapan › Simpanan & sandaran.',
        confirm: 'Ya, mula semula',
      },
    },
    hud: {
      journal: 'Jurnal misi',
      journalTip: 'Jurnal (J)',
      map: 'Peta dunia',
      mapTip: 'Peta (M)',
      inventory: 'Inventori',
      inventoryTip: 'Inventori (I)',
      pause: 'Menu jeda',
      pauseTip: 'Jeda (Esc)',
      profile: 'Profil diraja',
      princessName: 'Princess {HER_NAME}',
      guest: 'Tetamu Diraja',
      currentQuest: 'Misi semasa',
      questChapter: '{chapter} · Misi',
      saving: 'Menyimpan…',
      saveFailed: 'Gagal menyimpan',
      saved: 'Kemajuan disimpan',
      noPersistentStorage: 'Pelayar ini tidak membenarkan simpanan (mungkin mod peribadi). Permainan tetap boleh dimainkan, tetapi kemajuan akan hilang jika halaman ditutup.',
      ok: 'OK',
    },
    pauseMenu: {
      title: 'Jeda',
      subtitle: 'Kerajaan awak menunggu',
      resume: 'Sambung',
      journal: 'Jurnal Misi',
      map: 'Peta Dunia',
      inventory: 'Inventori',
      profile: 'Profil Diraja',
      settings: 'Tetapan',
      mainMenu: 'Menu Utama',
    },
    settings: {
      title: 'Tetapan',
      subtitle: 'Settings',
      audio: 'Audio',
      masterVolume: 'Kelantangan utama',
      music: 'Muzik',
      sfx: 'Kesan bunyi',
      muteAll: 'Senyapkan semua',
      thunder: 'Bunyi guruh',
      thunderVolume: 'Kelantangan guruh',
      letterMusic: 'Muzik semasa membaca surat',
      display: 'Paparan & keselesaan',
      reducedMotion: 'Kurangkan pergerakan (tiada kilat, kamera statik)',
      graphicsQuality: 'Kualiti grafik',
      qualityAuto: 'Auto',
      qualityLow: 'Rendah (jimat bateri)',
      qualityMedium: 'Sederhana',
      qualityHigh: 'Tinggi',
      renderMode: 'Mod paparan',
      modeAuto: 'Auto',
      mode3d: 'Dunia 3D',
      mode2d: 'Mod Buku Cerita (2D ringan)',
      noWebGL: 'WebGL tidak disokong pada peranti ini — Mod Buku Cerita digunakan.',
      textSpeed: 'Kelajuan teks',
      speedSlow: 'Perlahan',
      speedNormal: 'Biasa',
      speedFast: 'Laju',
      speedInstant: 'Serta-merta',
      controls: 'Kawalan',
      cameraSensitivity: 'Kepekaan kamera',
      invertY: 'Terbalikkan paksi Y kamera',
      computer: 'Komputer',
      computerHelp: 'WASD / anak panah — berjalan · Shift — berlari · Seret tetikus — kamera · Roda — zum · E — interaksi · Esc — jeda',
      touch: 'Telefon & tablet',
      touchHelp: 'Kayu bedik kiri — berjalan (tolak penuh untuk berlari) · Seret skrin — kamera · Cubit — zum · Butang emas — interaksi · Butang hati — bercakap dengan dia',
      saves: 'Simpanan & sandaran',
    },
    wardrobe: {
      title: 'Almari Diraja',
      subtitle: 'Ubah penampilan Princess',
      gownColor: 'Warna gaun',
      gownAccent: 'Hiasan gaun',
      hijabColor: 'Warna tudung',
      hijabTrim: 'Renda tudung',
      skinTone: 'Ton kulit',
      crownGem: 'Permata mahkota',
      presets: {
        rose: 'Rose Royale',
        sage: 'Sage Garden',
        lavender: 'Lavender Dream',
        champagne: 'Champagne Pearl',
        sunset: 'Dusty Sunset',
      },
      autoSaved: 'Penampilan disimpan secara automatik. Mahkota sentiasa kekal di atas tudung awak.',
    },
    profile: {
      title: 'Profil Diraja',
      subtitle: 'Royal Profile',
      guest: 'Tetamu Diraja',
      crownWorn: 'Mahkota rose-gold dipakai',
      crownWaiting: 'Mahkota menanti di Dataran Pertabalan',
      birthday: 'Hari lahir:',
      progress: 'Kemajuan',
      questsDone: 'Misi selesai',
      flowers: 'Bunga',
      stars: 'Bintang',
      timeInKingdom: 'Masa dalam kerajaan: ~{minutes} minit',
      wardrobe: 'Almari Diraja',
    },
    saves: {
      summary: '{quests} misi selesai · {flowers} bunga · {strawberries}/5 strawberry',
      summaryFinished: ' · tamat',
      exported: 'Fail simpanan telah dimuat turun. Simpan fail ini di tempat yang selamat.',
      exportFailed: 'Maaf, fail simpanan tidak dapat dibuat pada pelayar ini.',
      unreadableFile: 'Fail tidak dapat dibaca.',
      importRejected: 'Import ditolak: {error} Kemajuan semasa tidak diubah.',
      importConfirmTitle: 'Gantikan kemajuan semasa?',
      importConfirmBody: 'Fail ini mengandungi: {summary}.',
      importConfirmReplace: ' Kemajuan semasa ({summary}) akan diganti — satu salinan sandaran disimpan dahulu.',
      importConfirm: 'Ya, import fail simpanan',
      importCancelled: 'Import dibatalkan. Tiada apa-apa diubah.',
      imported: 'Fail simpanan berjaya diimport. Tekan "Sambung pengembaraan".',
      restoreTitle: 'Pulihkan salinan sandaran?',
      restoreBody: 'Salinan dari {time} ({summary}) akan menggantikan kemajuan semasa. Kemajuan semasa juga disimpan sebagai sandaran.',
      restoreConfirm: 'Ya, pulihkan',
      restored: 'Salinan sandaran dipulihkan.',
      resetTitle: 'Padam kemajuan & mula semula?',
      resetBody:
        'Ini akan memadam kemajuan yang disimpan dalam pelayar ini sahaja (misi, bunga, strawberry, kenangan). ' +
        'Tetapan tidak terjejas. Satu salinan sandaran disimpan dan boleh dipulihkan dari bahagian ini.',
      resetConfirm: 'Ya, padam & mula semula',
      whereSaved: 'Kemajuan disimpan secara automatik dalam',
      thisBrowserOnly: 'pelayar ini sahaja',
      noSync: '(localStorage) — tiada akaun, tiada penyegerakan antara peranti.',
      notPersistent: ' ⚠️ Pelayar ini tidak membenarkan simpanan kekal (mod peribadi?).',
      lastSaved: 'Simpanan terakhir:',
      saveFailed: '— gagal menyimpan',
      export: 'Eksport simpanan',
      import: 'Import simpanan',
      chooseFile: 'Pilih fail simpanan untuk diimport',
      restoreBackup: 'Pulihkan sandaran automatik',
      reset: 'Padam kemajuan & mula semula',
    },
    journal: {
      title: 'Jurnal Diraja',
      subtitle: 'Quest Journal',
      progress: 'Kemajuan pengembaraan',
      tabActive: 'Aktif',
      tabCompleted: 'Selesai',
      tabAll: 'Semua',
      empty: 'Tiada misi di sini buat masa ini.',
      locked: 'Misi ini akan terbuka dalam perjalanan nanti.',
      rewards: 'Ganjaran:',
    },
    inventory: {
      title: 'Inventori',
      subtitle: 'Barang, bunga & kenangan',
      tabItems: 'Barang',
      tabFlowers: 'Koleksi Bunga ({count})',
      tabKeepsakes: 'Kenangan',
      empty: 'Belum ada apa-apa. Pengembaraan baru bermula!',
      reread: 'Baca semula',
      flowersPicked: 'Bunga dikutip:',
      flowersNeeded: '· Diperlukan {count} untuk Taman Impian.',
      blooms: 'Bunga ajaib yang mekar: {count}/{total}',
      memoryStars: 'Bintang Kenangan ({count}/{total})',
      memoryStarsEmpty: 'Cari bintang-bintang kecil yang bersinar di seluruh kerajaan.',
      notes: 'Nota Tersembunyi ({count}/{total})',
      notesEmpty: 'Ada nota rahsia di Taman Impian…',
      books: 'Buku Dibaca ({count}/{total})',
      booksEmpty: 'Buku-buku menanti di Perpustakaan Impian.',
      flowerNames: {
        pinkRose: 'Mawar merah jambu',
        whiteRose: 'Mawar putih',
        tulip: 'Tulip',
        sunflower: 'Bunga matahari',
        hydrangea: 'Hydrangea',
        cherryBlossom: 'Sakura',
      },
    },
    map: {
      title: 'Peta Kerajaan',
      subtitle: 'World Map · ketik lokasi untuk perjalanan pantas',
      mapLabel: 'Peta dunia',
      legendPrincess: 'Princess',
      legendHim: 'Dia',
      legendQuest: 'Misi semasa',
      inCastle: 'Anda berada di dalam istana',
      locked: 'Masih terkunci',
      lockedHelp: 'Teruskan cerita untuk membuka lokasi ini.',
      insideCastle: 'Dalam istana',
      travel: 'Pergi ke sana',
    },
    overlays: {
      continue: 'Teruskan',
      tapToContinue: 'Ketik untuk teruskan',
      crownedOn: 'Ditabalkan pada',
      continuePrincess: 'Teruskan, Tuan Puteri',
      notNow: 'Nanti dulu',
      noteMemory: 'Bintang Kenangan',
      noteBloom: 'Bunga Ajaib',
      noteClue: 'Petunjuk',
      noteSecret: 'Nota Rahsia',
      keepInHeart: 'Simpan dalam hati',
      openGift: 'Buka hadiah',
      tapToOpenGift: 'Ketik untuk membuka hadiah…',
      thankYou: 'Terima kasih',
      questComplete: 'MISI SELESAI · QUEST COMPLETE',
      creditsStats: '{quests} misi · {flowers} bunga · {stars} bintang kenangan · ~{minutes} minit bersama',
      keepExploring: 'Terus menjelajah kerajaan',
      cancel: 'Batal',
      close: 'Tutup',
      // letter
      closeLetter: 'Tutup surat',
      letterMusicOff: 'Matikan muzik surat',
      letterMusicOn: 'Hidupkan muzik surat',
      backgroundMusic: 'Muzik latar',
      openEnvelope: 'Buka sampul',
      previousPage: 'Halaman sebelum',
      nextPage: 'Halaman seterusnya',
      next: 'Seterusnya',
      // book
      closeBook: 'Tutup buku',
      openBook: 'Buka buku {title}',
      tapToOpen: 'Ketik untuk membuka',
      turnPage: 'Selak',
      // courtroom
      noteEvidence: 'Catat bukti',
      courtroom: 'Mahkamah Diraja',
      question: 'Soalan {count} / {total}',
      fairVerdict: 'Keputusan yang adil!',
      fairVerdictText: 'Puan Peguam telah membuktikan kebenaran dengan bijaksana dan belas kasihan.',
      announceVerdict: 'Umumkan keputusan',
      // mirror & cake
      thankMirror: 'Terima kasih, cermin ✨',
      wishKept: 'Hajat dah disimpan dalam hati. Sekarang…',
    },
    chat: {
      title: 'Sembang dengan {name}',
      remoteSubtitle: 'Disambungkan melalui proksi AI yang selamat',
      localSubtitle: 'Enjin dialog tempatan · berfungsi tanpa internet',
      placeholder: 'Tulis sesuatu untuk dia…',
      messageLabel: 'Mesej',
      send: 'Hantar',
      typing: 'Dia sedang menaip…',
      /** Shown in the chat only when the Gemini AI is switched on. */
      privacyNote: 'Mesej dalam sembang ini dihantar ke Google Gemini untuk dijawab. Jangan kongsi maklumat peribadi yang sensitif.',
      clear: 'Padam perbualan',
      clearConfirm: {
        title: 'Padam perbualan?',
        body: 'Semua mesej sembang dengan dia dalam pelayar ini akan dipadam. Kemajuan game tidak terjejas.',
        confirm: 'Ya, padam perbualan',
      },
    },
    dialogueBox: {
      speaking: '{name} berkata',
      narration: 'Narasi',
      next: 'Seterusnya',
    },
    mobile: {
      joystick: 'Kayu bedik pergerakan',
      talk: 'Talk to him',
      interact: 'Interaksi',
      next: 'Seterusnya',
      nextShort: 'Next',
      interactShort: 'Interact',
    },
    misc: {
      close: 'Tutup',
      skipScene: 'Langkau babak',
      skip: 'Langkau',
      portrait: 'Potret Princess',
      graphicsFallback: 'Grafik 3D terhenti — bertukar ke Mod Buku Cerita.',
      storybookMap: 'Peta kerajaan (Mod Buku Cerita)',
      storybookMode: 'Mod Buku Cerita (2D)',
      currentQuestHint: 'Misi sekarang: “{quest}” — {objective}{count}.',
    },
    error: {
      title: 'Alamak, ada sedikit gangguan…',
      body: 'Jangan risau — kemajuan awak tersimpan dengan selamat. Muat semula halaman untuk kembali ke kerajaan awak.',
      reload: 'Muat semula',
    },
  },
} as const;

export type PersonalContent = typeof personalContent;
