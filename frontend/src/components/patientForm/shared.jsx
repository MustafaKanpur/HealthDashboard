// Pieces shared by the add-patient and edit-patient forms, so both enforce
// the same rules and render the same fields. Validation mirrors the API's
// (app/models/schemas.py); the API stays authoritative and its 422s are
// mapped back onto these fields by serverFieldErrors.

import { IconCheck, IconPlus, IconX } from '../../icons.jsx'
import Skeleton, { SkeletonText } from '../ui/Skeleton.jsx'

// Base details: all four are needed for a patient to exist at all.
export const BASE_FIELDS = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'birthdate', label: 'Date of birth' },
  { key: 'sex', label: 'Sex' },
]

const RACE_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black or African American' },
  { value: 'asian', label: 'Asian' },
  { value: 'hawaiian', label: 'Native Hawaiian or Pacific Islander' },
  { value: 'native', label: 'American Indian or Alaska Native' },
  { value: 'other', label: 'Other' },
]
const ETHNICITY_OPTIONS = [
  { value: 'nonhispanic', label: 'Not Hispanic or Latino' },
  { value: 'hispanic', label: 'Hispanic or Latino' },
]
const MARITAL_OPTIONS = [
  { value: 'M', label: 'Married' },
  { value: 'S', label: 'Single' },
]

export const VITAL_SHORT = {
  systolic_bp: 'systolic BP',
  diastolic_bp: 'diastolic BP',
  bmi: 'BMI',
  smoking_status: 'smoking status',
}

// Diagnosis categories the risk models read (comorbidity flags and the
// chronic-condition count); everything else on a chart doesn't move a score.
export const MODEL_CATEGORIES = new Set(['Diabetes', 'Hypertension', 'Heart Disease', 'Other Chronic Conditions'])

export const REQUIRED_TAG = { kind: 'required', text: 'Required' }
export const ASSESSMENT_TAG = { kind: 'assessment', text: 'Needed to score' }
const OPTIONAL_TAG = { kind: 'optional', text: 'Optional' }
const MEASURED_ON_HINT = 'Date the values below were taken'

export function todayIso() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function describedBy(id, error, hint) {
  if (error) return `${id}-error`
  return hint ? `${id}-hint` : undefined
}

/**
 * Everything a form needs to know about its current state, derived in one
 * place so the fields, the readiness panel and the submit rule can't
 * disagree. `onFile` lists measurements the patient already has: they count
 * toward an assessment, and a blank field then means "keep the latest",
 * not "estimate".
 */
export function evaluate(values, measures, schema, onFile = {}) {
  const errors = {}
  const today = todayIso()

  const baseMissing = BASE_FIELDS.filter((field) => !String(values[field.key] ?? '').trim()).map((field) => field.key)

  if (values.birthdate) {
    if (values.birthdate > today) errors.birthdate = "Date of birth can't be in the future"
    else if (Number(today.slice(0, 4)) - Number(values.birthdate.slice(0, 4)) > 120)
      errors.birthdate = 'Date of birth is more than 120 years ago'
  }
  if (values.measured_on) {
    if (values.measured_on > today) errors.measured_on = "Can't be in the future"
    else if (values.birthdate && values.measured_on < values.birthdate)
      errors.measured_on = "Can't be before the date of birth"
  }

  // Parsed, in-range values only: a malformed entry counts as not entered.
  const valid = {}
  for (const spec of schema.measurements) {
    const raw = measures[spec.key]
    if (raw === '' || raw === undefined) continue
    if (spec.kind === 'choice') {
      valid[spec.key] = raw
      continue
    }
    const number = Number(raw)
    if (!Number.isFinite(number)) errors[spec.key] = 'Enter a number'
    else if (number < spec.min || number > spec.max)
      errors[spec.key] = `Enter a value from ${spec.min} to ${spec.max} ${spec.unit}`
    else valid[spec.key] = number
  }
  // Only a pair taken together can contradict itself; a new diastolic
  // reading isn't checked against a systolic from another day.
  if (valid.systolic_bp !== undefined && valid.diastolic_bp !== undefined && valid.diastolic_bp >= valid.systolic_bp) {
    errors.diastolic_bp = 'Must be lower than systolic pressure'
    delete valid.diastolic_bp
  }

  const present = (key) => valid[key] !== undefined || onFile[key] !== undefined
  const required = schema.measurements.filter((spec) => spec.required_for_assessment)
  const vitalsMissing = required.filter((spec) => !present(spec.key)).map((spec) => spec.key)
  const estimated = schema.measurements
    .filter((spec) => !spec.required_for_assessment && !present(spec.key))
    .map((spec) => spec.key)

  const inputErrors = Object.keys(errors)
  let outcome = 'assessed'
  if (baseMissing.length > 0 || inputErrors.length > 0) outcome = 'blocked'
  else if (vitalsMissing.length > 0) outcome = 'unassessed'

  return { errors, baseMissing, vitalsMissing, estimated, valid, inputErrors, outcome }
}

/** Map a FastAPI 422 onto form keys: the last path segment names the field. */
export function serverFieldErrors(detail) {
  const mapped = {}
  const general = []
  for (const issue of Array.isArray(detail) ? detail : []) {
    const key = issue.loc?.[issue.loc.length - 1]
    const message = String(issue.msg || '').replace(/^Value error, /, '')
    const structural = ['body', 'measurements', 'details', 'new_reading']
    if (typeof key === 'string' && !structural.includes(key)) mapped[key] = message
    else if (/diastolic/i.test(message)) mapped.diastolic_bp = message
    else general.push(message)
  }
  return { mapped, general }
}

/** Every field with a problem, in the order the fields appear on the page. */
export function problemKeysFor(state, serverErrors, schema) {
  const ordered = [...BASE_FIELDS.map((field) => field.key), 'measured_on', ...schema.measurements.map((s) => s.key)]
  return ordered.filter((key) => serverErrors[key] || state.errors[key] || state.baseMissing.includes(key))
}

export function labelFor(key, schema) {
  return (
    BASE_FIELDS.find((field) => field.key === key)?.label ||
    schema.measurements.find((spec) => spec.key === key)?.label ||
    'Measurement date'
  )
}

export function Field({ id, label, tag, hint, error, className = '', children }) {
  return (
    <div className={`field ${error ? 'is-invalid' : ''} ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        {tag && <span className={`field-tag field-tag--${tag.kind}`}>{tag.text}</span>}
      </label>
      {children}
      {error ? (
        <div className="field-error" id={`${id}-error`}>
          <IconX size={12} strokeWidth={2.4} />
          {error}
        </div>
      ) : (
        hint && (
          <div className="field-hint" id={`${id}-hint`}>
            {hint}
          </div>
        )
      )}
    </div>
  )
}

/** One line of a readiness checklist. */
export function ReadinessItem({ done, flagged, label, detail }) {
  const state = done ? 'done' : flagged ? 'flagged' : 'pending'
  return (
    <li className={`readiness-item is-${state}`}>
      <span className="readiness-mark" aria-hidden="true">
        {done ? <IconCheck size={12} strokeWidth={2.6} /> : flagged ? <IconX size={11} strokeWidth={2.6} /> : null}
      </span>
      <span className="readiness-label">{label}</span>
      {detail && <span className="readiness-detail mono">{detail}</span>}
      <span className="visually-hidden">{done ? '— complete' : '— not yet entered'}</span>
    </li>
  )
}

/** The explicit "can't save/add this yet" summary at the top of a form. */
export function FormAlert({ innerRef, title, problemKeys, state, serverErrors, generalErrors, schema, onJump }) {
  return (
    <div className="form-alert" role="alert" tabIndex={-1} ref={innerRef}>
      <div className="form-alert-title">{title}</div>
      <ul className="form-alert-list">
        {problemKeys.map((key) => (
          <li key={key}>
            <button type="button" className="form-alert-link" onClick={() => onJump(key)}>
              {labelFor(key, schema)}
            </button>
            <span> — {serverErrors[key] || state.errors[key] || 'required'}</span>
          </li>
        ))}
        {generalErrors.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </div>
  )
}

/** Name, date of birth, sex and the optional demographics. */
export function DetailsFields({ values, setValue, touch, errorFor, register }) {
  const textField = (key, label) => {
    const error = errorFor(key)
    return (
      <Field key={key} id={key} label={label} tag={REQUIRED_TAG} error={error}>
        <input
          ref={register(key)}
          id={key}
          type="text"
          autoComplete="off"
          maxLength={60}
          value={values[key]}
          onChange={(event) => setValue(key, event.target.value)}
          onBlur={() => touch(key)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(key, error)}
        />
      </Field>
    )
  }
  const sexError = errorFor('sex')

  return (
    <div className="field-grid">
      {textField('first_name', 'First name')}
      {textField('last_name', 'Last name')}

      <Field id="birthdate" label="Date of birth" tag={REQUIRED_TAG} error={errorFor('birthdate')}>
        <input
          ref={register('birthdate')}
          id="birthdate"
          type="date"
          max={todayIso()}
          value={values.birthdate}
          onChange={(event) => setValue('birthdate', event.target.value)}
          onBlur={() => touch('birthdate')}
          aria-invalid={Boolean(errorFor('birthdate'))}
          aria-describedby={describedBy('birthdate', errorFor('birthdate'))}
        />
      </Field>

      <div className={`field ${sexError ? 'is-invalid' : ''}`}>
        <div className="field-label" id="sex-label">
          Sex
          <span className="field-tag field-tag--required">Required</span>
        </div>
        <div
          className="choice-group"
          role="radiogroup"
          aria-labelledby="sex-label"
          aria-invalid={Boolean(sexError)}
          aria-describedby={sexError ? 'sex-error' : undefined}
        >
          {[
            { value: 'F', label: 'Female' },
            { value: 'M', label: 'Male' },
          ].map((option, index) => (
            <label key={option.value} className={`choice ${values.sex === option.value ? 'is-checked' : ''}`}>
              <input
                ref={index === 0 ? register('sex') : undefined}
                type="radio"
                name="sex"
                value={option.value}
                checked={values.sex === option.value}
                onChange={() => setValue('sex', option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {sexError && (
          <div className="field-error" id="sex-error">
            <IconX size={12} strokeWidth={2.4} />
            {sexError}
          </div>
        )}
      </div>

      {[
        { key: 'race', label: 'Race', options: RACE_OPTIONS },
        { key: 'ethnicity', label: 'Ethnicity', options: ETHNICITY_OPTIONS },
        { key: 'marital_status', label: 'Marital status', options: MARITAL_OPTIONS },
      ].map((select) => (
        <Field key={select.key} id={select.key} label={select.label} tag={OPTIONAL_TAG}>
          <select id={select.key} value={values[select.key]} onChange={(event) => setValue(select.key, event.target.value)}>
            <option value="">Not recorded</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      ))}

      <div className="field-pair">
        {[
          { key: 'city', label: 'City', placeholder: 'e.g. Boston' },
          { key: 'state', label: 'State', placeholder: 'e.g. Massachusetts' },
        ].map((text) => (
          <Field key={text.key} id={text.key} label={text.label} tag={OPTIONAL_TAG}>
            <input
              id={text.key}
              type="text"
              maxLength={80}
              placeholder={text.placeholder}
              value={values[text.key]}
              onChange={(event) => setValue(text.key, event.target.value)}
            />
          </Field>
        ))}
      </div>
    </div>
  )
}

/**
 * The measurement date plus the two groups of readings. With `onFile`
 * (editing), each field shows the latest value on record, and a blank field
 * means "keep it"; without it (adding), a blank lab means "estimate it".
 */
export function MeasurementFields({
  schema,
  measures,
  setMeasure,
  measuredOn,
  setMeasuredOn,
  touch,
  errorFor,
  register,
  state,
  onFile = {},
  editing = false,
}) {
  const requiredSpecs = schema.measurements.filter((spec) => spec.required_for_assessment)
  const optionalSpecs = schema.measurements.filter((spec) => !spec.required_for_assessment)
  const vitalsDone = requiredSpecs.length - state.vitalsMissing.length

  const latestOnFile = Object.values(onFile)
    .map((entry) => entry.date)
    .filter(Boolean)
    .sort()
    .pop()
  const enteredSomething = Object.keys(state.valid).length > 0
  const backdated = editing && enteredSomething && latestOnFile && measuredOn && measuredOn < latestOnFile

  const hintFor = (spec) => {
    const latest = onFile[spec.key]
    if (latest) {
      const shown = typeof latest.value === 'number' ? formatNumber(latest.value) : latest.value
      return `On file: ${shown}${spec.unit ? ` ${spec.unit}` : ''}${latest.date ? ` (${latest.date})` : ''}`
    }
    if (spec.required_for_assessment) return spec.kind === 'number' ? `${spec.min}–${spec.max} ${spec.unit}` : null
    return `Blank: estimated as ≈ ${formatNumber(spec.estimate)} ${spec.unit}`
  }

  const numberInput = (spec, tag) => {
    const id = `m-${spec.key}`
    const error = errorFor(spec.key)
    const hint = hintFor(spec)
    return (
      <Field key={spec.key} id={id} label={spec.label} tag={tag} hint={hint} error={error}>
        <div className="input-unit">
          <input
            ref={register(spec.key)}
            id={id}
            type="number"
            inputMode="decimal"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={measures[spec.key] ?? ''}
            onChange={(event) => setMeasure(spec.key, event.target.value)}
            onBlur={() => touch(spec.key)}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy(id, error, hint)}
          />
          <span className="input-unit-label" aria-hidden="true">
            {spec.unit}
          </span>
        </div>
      </Field>
    )
  }

  const smokingSpec = schema.measurements.find((spec) => spec.key === 'smoking_status')
  const smokingHint = hintFor(smokingSpec)
  // A vital already on file isn't "needed" any more; don't tag it as such.
  const vitalTag = (key) => (onFile[key] ? null : ASSESSMENT_TAG)

  return (
    <>
      <div className="field-grid field-grid--narrow">
        <Field
          id="measured_on"
          label="Measured on"
          hint={backdated ? `Before the latest reading on file (${latestOnFile}): it joins the history but won't change the score` : MEASURED_ON_HINT}
          error={errorFor('measured_on')}
        >
          <input
            ref={register('measured_on')}
            id="measured_on"
            type="date"
            max={todayIso()}
            value={measuredOn}
            onChange={(event) => setMeasuredOn(event.target.value)}
            onBlur={() => touch('measured_on')}
            aria-invalid={Boolean(errorFor('measured_on'))}
            aria-describedby={describedBy('measured_on', errorFor('measured_on'), MEASURED_ON_HINT)}
          />
        </Field>
      </div>

      <section className="measure-group" aria-labelledby="vitals-heading">
        <header className="measure-group-head">
          <h4 id="vitals-heading">{editing ? 'Vitals' : 'Needed for a risk assessment'}</h4>
          <span className="measure-group-count mono">
            {vitalsDone} of {requiredSpecs.length} {editing ? 'on record' : 'entered'}
          </span>
        </header>
        <p className="measure-group-note">
          {editing
            ? 'Anything entered is recorded as a new reading. Earlier readings stay in the history; the most recent one drives the score. Leave a field blank to keep what is on file.'
            : 'All four are required to score this patient on diabetes, hypertension and heart disease and include them in panel analytics.'}
        </p>
        <div className="field-grid">
          {requiredSpecs.filter((spec) => spec.kind === 'number').map((spec) => numberInput(spec, vitalTag(spec.key)))}
          <Field
            id="m-smoking_status"
            label={smokingSpec.label}
            tag={vitalTag('smoking_status')}
            hint={smokingHint}
            error={errorFor('smoking_status')}
          >
            <select
              ref={register('smoking_status')}
              id="m-smoking_status"
              value={measures.smoking_status ?? ''}
              onChange={(event) => setMeasure('smoking_status', event.target.value)}
              aria-describedby={describedBy('m-smoking_status', errorFor('smoking_status'), smokingHint)}
            >
              <option value="">{onFile.smoking_status ? 'Keep current' : 'Not recorded'}</option>
              {smokingSpec.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="measure-group" aria-labelledby="labs-heading">
        <header className="measure-group-head">
          <h4 id="labs-heading">{editing ? 'Labs' : 'Improve accuracy'}</h4>
          <span className="measure-group-count">Optional</span>
        </header>
        <p className="measure-group-note">
          Any lab with nothing on file is estimated from the panel median, the same way it is for existing patients
          without that result.
        </p>
        <div className="field-grid">{optionalSpecs.map((spec) => numberInput(spec, null))}</div>
      </section>
    </>
  )
}

/** Free-text medication list with add/remove rows. */
export function MedicationInputs({ medications, setMedications, placeholder = 'e.g. Metformin 500 MG Oral Tablet' }) {
  return (
    <>
      <ul className="med-list">
        {medications.map((name, index) => (
          <li key={index} className="med-row">
            <input
              type="text"
              maxLength={120}
              placeholder={placeholder}
              value={name}
              aria-label={`Medication ${index + 1}`}
              onChange={(event) =>
                setMedications((prev) => prev.map((existing, i) => (i === index ? event.target.value : existing)))
              }
            />
            {medications.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label={`Remove medication ${index + 1}`}
                onClick={() => setMedications((prev) => prev.filter((_, i) => i !== index))}
              >
                <IconX size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setMedications((prev) => [...prev, ''])}
        disabled={medications.length >= 40}
      >
        <IconPlus size={14} />
        Add another medication
      </button>
    </>
  )
}

export function IntakeSkeleton() {
  return (
    <div>
      <Skeleton width={120} height={13} radius={0} style={{ marginBottom: 20 }} />
      <Skeleton width={220} height={26} radius={0} />
      <div className="intake-layout" style={{ marginTop: 28 }}>
        <div className="intake-main">
          <div className="card">
            <SkeletonText lines={5} />
          </div>
          <div className="card">
            <SkeletonText lines={6} />
          </div>
        </div>
        <div className="readiness">
          <SkeletonText lines={8} />
        </div>
      </div>
    </div>
  )
}
