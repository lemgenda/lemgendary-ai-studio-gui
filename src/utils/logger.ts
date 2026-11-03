/**
 * LemGendary AI Studio - diagnostic logging for recoverable failures.
 *
 * A failure that the UI recovers from (offline sidecar, fallback catalog,
 * non-JSON error body) is still reported here with its context, so no error
 * is dropped silently. Failures the user must act on go to UI error state.
 */

const PREFIX = "[LemGendary AI Studio]";

/** Readable text for any thrown value. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Resolve to `null` when `promise` rejects, logging the failure with `context`.
 * For optional reads whose absence the caller already handles.
 */
export function nullOnFailure<T>(
  promise: Promise<T>,
  context: string,
  level: "debug" | "warn" = "warn"
): Promise<T | null> {
  return promise.catch((err: unknown) => {
    logger[level](context, err);
    return null;
  });
}

export const logger = {
  /** Expected, frequent failures (liveness probes, polling while a sidecar starts). */
  debug(context: string, err?: unknown): void {
    console.debug(`${PREFIX} ${context}`, ...(err === undefined ? [] : [err]));
  },
  /** Recovered failures: the UI fell back to a default or offline state. */
  warn(context: string, err?: unknown): void {
    console.warn(`${PREFIX} ${context}`, ...(err === undefined ? [] : [err]));
  },
  /** Failures the UI could not recover from. */
  error(context: string, err?: unknown): void {
    console.error(`${PREFIX} ${context}`, ...(err === undefined ? [] : [err]));
  },
};
