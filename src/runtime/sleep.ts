/** Thrown inside a thread when it has been stopped. */
export class Stopped extends Error {
  constructor() {
    super('stopped');
    this.name = 'Stopped';
  }
}

/** Wait `ms` milliseconds; rejects with Stopped as soon as `signal` aborts. */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Stopped());
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Stopped());
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
