import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { personalContent } from '../../config/personalContent';

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  /** Tailwind max-width class. */
  width?: string;
  footer?: ReactNode;
}

/** Royal-styled modal panel used by journal, map, inventory and settings. */
export function Modal({ title, subtitle, icon, onClose, children, width = 'max-w-2xl', footer }: ModalProps) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <motion.div
      className="safe-pad absolute inset-0 z-40 flex items-center justify-center bg-plum-deep/40"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`royal-panel relative flex max-h-full w-full ${width} flex-col overflow-hidden`}
        initial={{ y: 24, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 16, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="flex items-center gap-3 px-5 pb-3 pt-4 sm:px-6">
          {icon && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-sage-soft to-sage text-forest">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl font-semibold leading-tight text-plum sm:text-3xl">{title}</h2>
            {subtitle && <p className="truncate text-xs text-plum/60 sm:text-sm">{subtitle}</p>}
          </div>
          {onClose && (
            <button className="icon-btn shrink-0" onClick={onClose} aria-label={personalContent.ui.misc.close}>
              <X size={20} />
            </button>
          )}
        </div>
        <div className="divider-gold mx-5" />
        <div className="scroll-y min-h-0 flex-1 px-5 py-4 sm:px-6">{children}</div>
        {footer && (
          <>
            <div className="divider-gold mx-5" />
            <div className="px-5 py-3 sm:px-6">{footer}</div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
