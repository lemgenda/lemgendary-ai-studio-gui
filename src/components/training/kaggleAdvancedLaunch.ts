/**
 * LemGendary AI Studio - advanced Kaggle launch fields: the clone refs
 * (`git_ref`, `env_manager_ref`) and the session window (`limit_hours`,
 * `margin_minutes`) of `POST /api/training/kaggle/train`.
 *
 * Every field is empty by default and an empty field is not sent, so a plain
 * launch keeps the Training Suite defaults (`main`, `kaggle_session` of
 * config.yaml). The checks mirror the Training Suite (`training/notebooks/git_ref.py`
 * and `SessionWindowOverride`), which answers 422 for a value they refuse.
 */

import {
  KAGGLE_GIT_REF_MAX_LENGTH,
  KAGGLE_LIMIT_HOURS_EXCLUSIVE_MIN,
  KAGGLE_MARGIN_MINUTES_MIN,
  KaggleTrainPayload,
} from "../../api/types";

/** Payload fields the advanced group may add; a key is present only when its field is set. */
export type KaggleAdvancedFields = Pick<KaggleTrainPayload, "git_ref" | "env_manager_ref" | "limit_hours" | "margin_minutes">;

/** Form state: each field stays text while typing; "" = not sent. */
export interface KaggleAdvancedForm {
  gitRef: string;
  envManagerRef: string;
  limitHours: string;
  marginMinutes: string;
}

export type KaggleAdvancedField = keyof KaggleAdvancedForm;

/** Validation message per field; a field without an entry is valid (or empty). */
export type KaggleAdvancedErrors = Partial<Record<KaggleAdvancedField, string>>;

export const DEFAULT_KAGGLE_ADVANCED_FORM: KaggleAdvancedForm = {
  gitRef: "",
  envManagerRef: "",
  limitHours: "",
  marginMinutes: "",
};

const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const REF_FORBIDDEN_SEQUENCES = ["..", "//", "@{", "/."];
const REF_FORBIDDEN_ENDINGS = ["/", ".", ".lock"];

/** Why `ref` is not a branch, tag or commit name the Training Suite accepts; null when it is. */
export function gitRefError(ref: string): string | null {
  if (ref.length === 0 || ref.length > KAGGLE_GIT_REF_MAX_LENGTH) {
    return `Git ref must have 1 to ${KAGGLE_GIT_REF_MAX_LENGTH} characters`;
  }
  if (!REF_PATTERN.test(ref)) {
    return `Git ref '${ref}' may only use letters, digits, '.', '_', '/' and '-' and must start with a letter or digit`;
  }
  if (REF_FORBIDDEN_SEQUENCES.some((seq) => ref.includes(seq)) || REF_FORBIDDEN_ENDINGS.some((end) => ref.endsWith(end))) {
    return `Git ref '${ref}' is not a valid branch, tag or commit name`;
  }
  return null;
}

/** The typed number, or null when the text is not a finite number. */
function parseNumber(text: string): number | null {
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function refFieldError(text: string): string | undefined {
  const ref = text.trim();
  return ref === "" ? undefined : (gitRefError(ref) ?? undefined);
}

function limitHoursError(text: string): string | undefined {
  if (text.trim() === "") return undefined;
  const value = parseNumber(text.trim());
  if (value === null) return "Session limit must be a number of hours";
  if (value <= KAGGLE_LIMIT_HOURS_EXCLUSIVE_MIN) return `Session limit must be greater than ${KAGGLE_LIMIT_HOURS_EXCLUSIVE_MIN} hours`;
  return undefined;
}

function marginMinutesError(text: string, limitText: string): string | undefined {
  if (text.trim() === "") return undefined;
  const value = parseNumber(text.trim());
  if (value === null) return "Stop margin must be a number of minutes";
  if (value < KAGGLE_MARGIN_MINUTES_MIN) return `Stop margin must be ${KAGGLE_MARGIN_MINUTES_MIN} minutes or more`;
  const limit = limitText.trim() === "" || limitHoursError(limitText) ? null : parseNumber(limitText.trim());
  if (limit !== null && value * 60 >= limit * 3600) {
    return `Stop margin must be below the session limit (${limit * 60} minutes)`;
  }
  return undefined;
}

/** Validation messages of the advanced fields (the Training Suite rules); empty fields are valid. */
export function advancedFormErrors(form: KaggleAdvancedForm): KaggleAdvancedErrors {
  const errors: KaggleAdvancedErrors = {
    gitRef: refFieldError(form.gitRef),
    envManagerRef: refFieldError(form.envManagerRef),
    limitHours: limitHoursError(form.limitHours),
    marginMinutes: marginMinutesError(form.marginMinutes, form.limitHours),
  };
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message !== undefined));
}

/** Whether every advanced field is empty or valid. */
export function isAdvancedFormValid(form: KaggleAdvancedForm): boolean {
  return Object.keys(advancedFormErrors(form)).length === 0;
}

/**
 * Payload fields of the advanced form: only the set fields, trimmed and parsed.
 * Call with a valid form (see `isAdvancedFormValid`); an invalid field is left out.
 */
export function advancedLaunchFields(form: KaggleAdvancedForm): KaggleAdvancedFields {
  const errors = advancedFormErrors(form);
  const fields: KaggleAdvancedFields = {};
  const gitRef = form.gitRef.trim();
  const envManagerRef = form.envManagerRef.trim();
  const limitHours = form.limitHours.trim();
  const marginMinutes = form.marginMinutes.trim();
  if (gitRef !== "" && !errors.gitRef) fields.git_ref = gitRef;
  if (envManagerRef !== "" && !errors.envManagerRef) fields.env_manager_ref = envManagerRef;
  if (limitHours !== "" && !errors.limitHours) fields.limit_hours = Number(limitHours);
  if (marginMinutes !== "" && !errors.marginMinutes) fields.margin_minutes = Number(marginMinutes);
  return fields;
}
