import { motion } from 'framer-motion';
import { useMemo } from 'react';

/**
 * Handwriting-style reveal: words fade and "ink in" one after another.
 * `instant` shows everything at once (reduced motion or tap-to-reveal).
 */
export function Handwriting({
  text,
  delay = 0,
  perWord = 0.055,
  instant = false,
  className = '',
}: {
  text: string;
  delay?: number;
  perWord?: number;
  instant?: boolean;
  className?: string;
}) {
  const words = useMemo(() => text.split(/(\s+)/), [text]);
  if (instant) return <p className={className}>{text}</p>;
  let i = 0;
  return (
    <p className={className} aria-label={text}>
      {words.map((w, idx) => {
        if (/^\s+$/.test(w)) return <span key={idx}>{w}</span>;
        const d = delay + i++ * perWord;
        return (
          <motion.span
            key={idx}
            aria-hidden
            initial={{ opacity: 0, filter: 'blur(3px)', y: 2 }}
            animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
            transition={{ delay: d, duration: 0.45, ease: 'easeOut' }}
            className="inline-block"
          >
            {w}
          </motion.span>
        );
      })}
    </p>
  );
}

/** Seconds until a Handwriting block with this text finishes. */
export function handwritingDuration(text: string, perWord = 0.055) {
  return text.split(/\s+/).filter(Boolean).length * perWord + 0.45;
}
