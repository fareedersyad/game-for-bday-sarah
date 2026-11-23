import { Heart, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dialogueConfig } from '../../config/dialogueConfig';
import { personalContent } from '../../config/personalContent';
import { getSave, useGameStore } from '../../stores/gameStore';
import { useUI } from '../../stores/uiStore';
import { clearChat, loadChat, saveChat, turnsForAI, type StoredTurn } from '../../systems/DialogueManager/chatHistory';
import { describeContext, localFreeChat } from '../../systems/DialogueManager/dialogueEngine';
import { askRemoteCompanion, isRemoteAIEnabled } from '../../systems/DialogueManager/remoteAI';
import { speakerName } from '../../systems/Story/cutscene';
import type { LocationId } from '../../systems/WorldManager/worldTypes';
import { fill, fmt } from '../../utils/text';
import { Modal } from '../ui/Modal';

const C = personalContent.ui.chat;

/**
 * Free chat with Prince Fareed.
 *
 * - With a secure proxy configured (VITE_AI_PROXY_URL) replies come from
 *   Google Gemini; on any failure the offline engine answers instead and a
 *   small notice says so.
 * - The conversation is remembered in this browser (see chatHistory.ts), so
 *   it survives a refresh; the most recent turns are sent, in order, as his
 *   memory of the conversation.
 */
export function ChatPanel() {
  const close = useUI((s) => s.closePanel);
  const openOverlay = useUI((s) => s.openOverlay);
  const [turns, setTurns] = useState<StoredTurn[]>(() => loadChat());
  const turnsRef = useRef(turns);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const remote = isRemoteAIEnabled();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  /** Single place that updates the conversation: memory, screen and browser storage. */
  const commit = (next: StoredTurn[]) => {
    turnsRef.current = next;
    saveChat(next);
    setTurns(next);
  };

  const send = async () => {
    const msg = text.trim().slice(0, 400);
    if (!msg || busy) return;
    setText('');
    const history = [...turnsRef.current, { role: 'user', content: msg, source: 'user', at: Date.now() } satisfies StoredTurn];
    commit(history);
    setBusy(true);
    const ctx = { location: useUI.getState().location as LocationId, save: getSave() };
    const added: StoredTurn[] = [];
    try {
      if (!remote) throw new Error('local');
      const { reply } = await askRemoteCompanion(turnsForAI(history), describeContext(ctx));
      added.push({ role: 'assistant', content: reply, source: 'gemini', at: Date.now() });
    } catch (e) {
      const local = localFreeChat(msg, ctx);
      useGameStore.getState().recordLine(local.id);
      added.push({ role: 'assistant', content: local.text, source: 'local', at: Date.now() });
      if (remote && (e as Error).message !== 'local') {
        added.push({ role: 'assistant', content: dialogueConfig.freeChat.aiUnavailable, source: 'notice', at: Date.now() });
      }
    }
    // Append to the LATEST conversation (the panel may have been cleared meanwhile).
    commit([...turnsRef.current, ...added]);
    setBusy(false);
  };

  const clear = async () => {
    const ok = await openOverlay<boolean>({
      type: 'confirm',
      title: C.clearConfirm.title,
      message: C.clearConfirm.body,
      confirmLabel: C.clearConfirm.confirm,
      danger: true,
    });
    if (!ok) return;
    clearChat();
    turnsRef.current = [];
    setTurns([]);
  };

  return (
    <Modal
      title={fmt(C.title, { name: speakerName('him') })}
      subtitle={remote ? C.remoteSubtitle : C.localSubtitle}
      icon={<Heart size={18} className="fill-current" />}
      onClose={close}
      width="max-w-lg"
      footer={
        <div className="flex flex-col gap-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={400}
              placeholder={C.placeholder}
              className="min-w-0 flex-1 rounded-full border border-gold/50 bg-white/80 px-4 py-2.5 text-[16px] text-plum outline-none focus:border-rosy"
              aria-label={C.messageLabel}
              autoComplete="off"
            />
            <button className="rose-btn !px-4" disabled={busy || !text.trim()} aria-label={C.send}>
              <Send size={18} />
            </button>
          </form>
          {(remote || turns.length > 0) && (
            <div className="flex items-start justify-between gap-3 text-[11px] leading-snug text-plum/60">
              {remote ? (
                <p className="flex items-start gap-1" data-testid="chat-privacy-note">
                  <ShieldCheck size={13} className="mt-px shrink-0 text-sage-deep" />
                  {C.privacyNote}
                </p>
              ) : (
                <span />
              )}
              {turns.length > 0 && (
                <button type="button" className="flex shrink-0 items-center gap-1 font-bold text-rosy-deep disabled:opacity-40" onClick={() => void clear()} disabled={busy}>
                  <Trash2 size={12} /> {C.clear}
                </button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div ref={listRef} className="scroll-y flex max-h-[50vh] flex-col gap-2.5" data-testid="chat-log">
        <Bubble role="assistant" text={fill(dialogueConfig.freeChat.intro)} />
        {turns.map((t, i) =>
          t.source === 'notice' ? (
            <p key={i} className="px-2 text-center text-xs italic text-plum/55">
              {t.content}
            </p>
          ) : (
            <Bubble key={i} role={t.role} text={t.content} />
          ),
        )}
        {busy && (
          <div className="flex items-center gap-1.5 text-sm text-plum/60">
            <Sparkles size={14} className="animate-pulse text-gold" /> {C.typing}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Bubble({ role, text }: { role: StoredTurn['role']; text: string }) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
          role === 'user' ? 'rounded-br-md bg-gradient-to-b from-gold-soft to-champagne text-plum' : 'rounded-bl-md bg-white/85 text-plum shadow-sm'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
