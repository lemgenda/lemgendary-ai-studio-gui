/**
 * LemGendary AI Studio - what a local training launch from a model card sends
 * besides the model key.
 */

export interface LocalTrainSettings {
  /** Batch size picked on the card; undefined = the registry default. */
  batchSize?: number;
  /** Resume although a frozen run setting changed (`override_frozen`; quick-train only). */
  overrideFrozen: boolean;
}
