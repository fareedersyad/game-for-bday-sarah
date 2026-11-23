import { Download, History, RotateCcw, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { getSave } from '../../stores/gameStore';
import { currentSettings } from '../../stores/settingsStore';
import { useUI } from '../../stores/uiStore';
import { getStorageStatus } from '../../systems/SaveManager/safeStorage';
import { hasProgress, saveManager, summarize, useSaveStatus } from '../../systems/SaveManager/saveManager';
import { loadSaveIntoGame, resetProgress } from '../../systems/Story/story';
import { fill, fmt } from '../../utils/text';
import { personalContent } from '../../config/personalContent';

const V = personalContent.ui.saves;

type Msg = { kind: 'ok' | 'error'; text: string } | null;

const fmtTime = (t: number | null) =>
  t ? new Date(t).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function summaryLine(s: ReturnType<typeof summarize>) {
  return fmt(V.summary, { quests: s.quests, flowers: s.flowers, strawberries: s.strawberries }) + (s.finished ? V.summaryFinished : '');
}

/**
 * Save management: status, export / import of a JSON backup, restoring the
 * automatic backup, and a clearly-confirmed reset. Everything is local to
 * this browser.
 */
export function SaveManagement() {
  const lastSavedAt = useSaveStatus((s) => s.lastSavedAt);
  const saveState = useSaveStatus((s) => s.state);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [backup, setBackup] = useState(() => saveManager.readBackup());
  const persistent = getStorageStatus() === 'persistent';
  const confirm = (title: string, message: string, confirmLabel: string, danger = true) =>
    useUI.getState().openOverlay<boolean>({ type: 'confirm', title, message, confirmLabel, danger });

  const doExport = () => {
    try {
      saveManager.flush();
      const text = saveManager.exportText(getSave(), currentSettings() as unknown as Record<string, unknown>);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = fill(gameConfig.HER_NAME).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'princess';
      a.href = url;
      a.download = `kerajaan-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setMsg({ kind: 'ok', text: V.exported });
    } catch {
      setMsg({ kind: 'error', text: V.exportFailed });
    }
  };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setMsg({ kind: 'error', text: V.unreadableFile });
      return;
    }
    const parsed = saveManager.parseImport(text);
    if (!parsed.ok) {
      setMsg({ kind: 'error', text: fmt(V.importRejected, { error: parsed.error }) });
      return;
    }
    const current = getSave();
    const ok = await confirm(
      V.importConfirmTitle,
      fmt(V.importConfirmBody, { summary: summaryLine(parsed.summary) }) +
        (hasProgress(current) ? fmt(V.importConfirmReplace, { summary: summaryLine(summarize(current)) }) : ''),
      V.importConfirm,
    );
    if (!ok) {
      setMsg({ kind: 'ok', text: V.importCancelled });
      return;
    }
    loadSaveIntoGame(parsed.data, parsed.settings, 'import');
    useUI.getState().toast(V.imported, 'scroll');
  };

  const doRestore = async () => {
    const b = saveManager.readBackup();
    if (!b) return;
    const ok = await confirm(
      V.restoreTitle,
      fmt(V.restoreBody, { time: fmtTime(b.info.savedAt), summary: summaryLine(b.info.summary) }),
      V.restoreConfirm,
    );
    if (!ok) return;
    loadSaveIntoGame(b.data, null, 'restore');
    useUI.getState().toast(V.restored, 'scroll');
  };

  const doReset = async () => {
    const ok = await confirm(
      V.resetTitle,
      V.resetBody,
      V.resetConfirm,
    );
    if (!ok) return;
    resetProgress();
    setBackup(saveManager.readBackup());
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 rounded-2xl bg-white/60 p-3 text-xs leading-relaxed text-plum/80">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sage-deep" />
        <span>
          {V.whereSaved} <b>{V.thisBrowserOnly}</b> {V.noSync}
          {persistent ? '' : V.notPersistent}
          <br />
          {V.lastSaved} <b>{fmtTime(lastSavedAt)}</b>
          {saveState === 'failed' && <span className="ml-1 font-bold text-strawberry">{V.saveFailed}</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button className="soft-btn w-full !py-2.5" onClick={doExport}>
          <Download size={16} /> {V.export}
        </button>
        <button className="soft-btn w-full !py-2.5" onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> {V.import}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label={V.chooseFile}
        data-testid="save-import-input"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />

      {backup && (
        <button className="soft-btn w-full !py-2.5 text-left" onClick={() => void doRestore()}>
          <History size={16} className="shrink-0" />
          <span>
            {V.restoreBackup}
            <span className="block text-[11px] font-normal text-plum/60">
              {fmtTime(backup.info.savedAt)} · {summaryLine(backup.info.summary)}
            </span>
          </span>
        </button>
      )}

      {msg && (
        <p
          role={msg.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-1.5 rounded-2xl px-3 py-2 text-sm ${msg.kind === 'error' ? 'bg-strawberry-soft text-plum' : 'bg-sage-soft/60 text-forest'}`}
        >
          {msg.kind === 'error' && <TriangleAlert size={15} className="mt-0.5 shrink-0 text-strawberry" />}
          {msg.text}
        </p>
      )}

      <button className="soft-btn mt-1 w-full !border-strawberry/40 !text-strawberry" onClick={() => void doReset()}>
        <RotateCcw size={16} /> {V.reset}
      </button>
    </div>
  );
}
