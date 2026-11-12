/**
 * LemGendary AI Studio - Kaggle handles (registry slug, dataset URLs) of the model
 * shown in the cloud dialog, from `GET /api/models/{model_key}`.
 */

import { useEffect, useState } from "react";
import { fetchModelKaggleHandles, ModelKaggleHandles } from "../../api/client";

/** null while loading, while no model is open, and when the Training Suite cannot answer. */
export function useModelKaggleHandles(modelKey: string | null): ModelKaggleHandles | null {
  const [handles, setHandles] = useState<ModelKaggleHandles | null>(null);

  useEffect(() => {
    setHandles(null);
    if (!modelKey) return undefined;
    let active = true;
    void fetchModelKaggleHandles(modelKey).then((next) => {
      if (active) setHandles(next);
    });
    return () => {
      active = false;
    };
  }, [modelKey]);

  return handles;
}
