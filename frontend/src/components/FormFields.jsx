// Small, accessible form building blocks used by every form in the app.
// Each input is linked to its label and error message, so screen readers
// announce "Email, invalid: Enter a valid email address".
import { useId } from "react";
import { useI18n } from "../i18n";

function FieldShell({ id, label, hint, error, required, children }) {
  const { t } = useI18n();
  return (
    <div className={error ? "field field--error" : "field"}>
      <label htmlFor={id} className="field__label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : <span className="field__optional"> {t("common.optional")}</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id, hint, error) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({ label, hint, error, required = false, value, onChange, ...inputProps }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <input
        id={id}
        className="input"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...inputProps}
      />
    </FieldShell>
  );
}

export function TextArea({ label, hint, error, required = false, value, onChange, ...inputProps }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={id}
        className="input input--textarea"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...inputProps}
      />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, required = false, value, onChange, options, placeholder }) {
  const id = useId();
  const { t } = useI18n();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required}>
      <select
        id={id}
        className="input"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
      >
        <option value="">{placeholder || t("common.select")}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Multiple choice as toggle chips (real checkboxes underneath). */
export function ChipGroup({ legend, hint, error, options, values, onChange }) {
  const id = useId();
  const toggle = (value) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

  return (
    <fieldset className={error ? "field field--error" : "field"} aria-describedby={describedBy(id, hint, error)}>
      <legend className="field__label">{legend}</legend>
      {hint && !error && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      <div className="chips">
        {options.map((option) => (
          <label key={option.value} className="chip">
            <input
              type="checkbox"
              checked={values.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** 1–5 self-rating as a row of radio buttons. */
export function RatingField({ legend, lowLabel, highLabel, value, onChange }) {
  const name = useId();
  const { t } = useI18n();
  return (
    <fieldset className="field">
      <legend className="field__label">
        {legend}
        <span className="field__optional"> {t("common.optional")}</span>
      </legend>
      <div className="rating">
        <span className="rating__end">{lowLabel}</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="rating__option">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span>{n}</span>
          </label>
        ))}
        <span className="rating__end">{highLabel}</span>
        {value != null && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => onChange(null)}>
            {t("common.clear")}
          </button>
        )}
      </div>
    </fieldset>
  );
}
