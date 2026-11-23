/**
 * ============================================================================
 *  GAME CONFIGURATION — gameplay settings.
 * ============================================================================
 *
 *  All TEXT (names, letters, messages, dialogue…) now lives in
 *  src/config/personalContent.ts — see PERSONAL_CONTENT_GUIDE.md.
 *  This file only combines that text with a few gameplay numbers and keeps
 *  the shape the rest of the game already reads (gameConfig.HER_NAME, …).
 * ============================================================================
 */
import { personalContent as P } from './personalContent';

export type { BookContent, LetterContent, SharedMemory } from './personalContent';

export const gameConfig = {
  // ---------------------------------------------------------------- identity
  HER_NAME: P.names.HER_NAME,
  HER_NICKNAME: P.names.HER_NICKNAME,
  YOUR_NAME: P.names.YOUR_NAME,
  YOUR_NICKNAME: P.names.YOUR_NICKNAME,
  BIRTHDAY_DATE: P.names.BIRTHDAY_DATE,
  ROYAL_TITLE: P.royalTitle,

  // ---------------------------------------------------------------- story text
  OPENING: P.opening,
  LOVE_LETTER: P.loveLetter,
  FINAL_MESSAGE: P.finalMessage,
  FINAL_SECRET_MESSAGE: P.finalSecretLetter,
  SECRET_GIFT: P.secretGift,
  NPC_PERSONALITY: P.companion,
  SHARED_MEMORIES: P.memoryStars,
  CUSTOM_BOOK_MESSAGES: P.books,

  // ---------------------------------------------------------------- adventures (text + gameplay numbers)
  GARDEN: {
    /** Flowers she must pick to complete the garden. */
    flowersRequired: 10,
    ...P.garden,
  },
  MIRROR: {
    ...P.mirror,
    /** Pause before the mirror answers (milliseconds). */
    revealDelayMs: 2000,
  },
  COURTROOM: P.courtroom,
  CHILDREN: P.children,
  STORM: P.storm,
  STRAWBERRY_GARDEN: {
    /** How many ripe strawberries she must pick (there are exactly this many picking spots). */
    required: 5,
    ...P.strawberryGarden,
  },
  BIRTHDAY_CAKE: {
    /** Number of candles on the cake (purely visual). */
    candles: 5,
    ...P.birthdayCake,
  },
  CREDITS: P.credits,

  // ---------------------------------------------------------------- music box
  /**
   * Song played by the Music Box in the Grand Hall (next to the throne).
   * The file lives in public/; the title shown on screen is in personalContent.ts.
   */
  MUSIC_BOX: {
    file: 'audio/jatuh-suka.mp3',
  },
} as const;

export type GameConfig = typeof gameConfig;
