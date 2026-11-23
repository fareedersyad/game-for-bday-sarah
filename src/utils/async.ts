export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Resolve on the next animation frame (or a timeout in non-browser tests). */
export const nextFrame = () =>
  new Promise<void>((r) => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
