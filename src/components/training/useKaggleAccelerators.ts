/**
 * LemGendary AI Studio - Kaggle accelerator choices for the cloud launch form:
 * `GET /api/training/kaggle/accelerators`, else the ecosystem snapshot (offline).
 */

import { useEffect, useState } from "react";
import { fetchKaggleAccelerators, KaggleAcceleratorChoices } from "../../api/client";

/** Loads the choices once while `enabled`; null until the first answer. */
export function useKaggleAccelerators(enabled: boolean): KaggleAcceleratorChoices | null {
  const [choices, setChoices] = useState<KaggleAcceleratorChoices | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    void fetchKaggleAccelerators().then((next) => {
      if (active) setChoices(next);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return choices;
}
