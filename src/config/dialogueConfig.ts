/**
 * ============================================================================
 *  DIALOGUE CONFIGURATION
 * ============================================================================
 *  Every line of dialogue now lives in src/config/personalContent.ts
 *  (section 6. DIALOG). This file keeps the names the game already uses.
 * ============================================================================
 */
import { personalContent } from './personalContent';

export type { ScriptLine } from './personalContent';

export const SPEAKER_NAMES = personalContent.speakerNames;

export const dialogueConfig = personalContent.dialogue;

export type DialogueConfig = typeof dialogueConfig;
