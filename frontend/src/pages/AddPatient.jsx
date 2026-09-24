import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPatient, getIntakeSchema } from '../api/client.js'
import { IconArrowLeft, IconCheck, IconClipboard, IconFlask, IconUserPlus } from '../icons.jsx'
import PageHero from '../components/ui/PageHero.jsx'
import Card from '../components/ui/Card.jsx'
import {
  BASE_FIELDS,
  DetailsFields,
  FormAlert,
  IntakeSkeleton,
  MeasurementFields,
  MedicationInputs,
  ReadinessItem,
  VITAL_SHORT,
  evaluate,
  formatNumber,
  problemKeysFor,
  serverFieldErrors,
  todayIso,
} from '../components/patientForm/shared.jsx'
import { listPhrase } from '../measurements.js'

const EMPTY_VALUES = {
  first_name: '',
  last_name: '',
  birthdate: '',
  sex: '',
  race: '',
  ethnicity: '',
  marital_status: '',
  city: '',
  state: '',
  measured_on: todayIso(),
}

function AddPatient() {
  const navigate = useNavigate()
  const [schema, setSchema] = useState(null)
  const [schemaError, setSchemaError] = useState(null)

  const [values, setValues] = useState(EMPTY_VALUES)
  const [measures, setMeasures] = useState({})
  const [conditions, setConditions] = useState([])
  const [medications, setMedications] = useState([''])

  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [generalErrors, setGeneralErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const fieldRefs = useRef({})
  const summaryRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getIntakeSchema()
      .then((data) => {
        if (!cancelled) setSchema(data)
      })
      .catch((err) => {
        if (!cancelled) setSchemaError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const state = useMemo(() => (schema ? evaluate(values, measures, schema) : null), [values, measures, schema])

  if (schemaError) return <div className="error-banner">Couldn't load the intake form: {schemaError}</div>
  if (!schema || !state) return <IntakeSkeleton />

  const requiredSpecs = schema.measurements.filter((spec) => spec.required_for_assessment)
  const optionalSpecs = schema.measurements.filter((spec) => !spec.required_for_assessment)

  // Base details only nag once an add has been attempted; a malformed value
  // shows as soon as you leave the field, since it's wrong either way.
  const errorFor = (key) => {
    if (serverErrors[key]) return serverErrors[key]
    if (state.errors[key] && (touched[key] || attempted)) return state.errors[key]
    if (attempted && state.baseMissing.includes(key)) return 'Required to add the patient'
    return null
  }
  const clearServerError = (key) => {
    if (serverErrors[key]) setServerErrors(({ [key]: _removed, ...rest }) => rest)
  }
  const setValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    clearServerError(key)
  }
  const setMeasure = (key, value) => {
    setMeasures((prev) => ({ ...prev, [key]: value }))
    clearServerError(key)
  }
  const touch = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  const register = (key) => (node) => {
    if (node) fieldRefs.current[key] = node
  }
  const focusField = (key) => {
    const node = fieldRefs.current[key]
    if (node) {
      node.focus()
      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  const problemKeys = problemKeysFor(state, serverErrors, schema)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    setGeneralErrors([])
    if (state.outcome === 'blocked') {
      // Say why here and now: the summary is announced, and focus lands on
      // the first field to fix.
      requestAnimationFrame(() => {
        if (problemKeys[0]) focusField(problemKeys[0])
      })
      return
    }

    const optional = (value) => (String(value).trim() ? String(value).trim() : null)
    const payload = {
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      birthdate: values.birthdate,
      sex: values.sex,
      race: values.race || null,
      ethnicity: values.ethnicity || null,
      marital_status: values.marital_status || null,
      city: optional(values.city),
      state: optional(values.state),
      measured_on: values.measured_on || null,
      measurements: state.valid,
      conditions,
      medications: medications.map((name) => name.trim()).filter(Boolean),
    }

    setSubmitting(true)
    try {
      const detail = await createPatient(payload)
      navigate(`/patients/${detail.id}`, { state: { justAdded: true } })
    } catch (err) {
      if (err.status === 422) {
        const { mapped, general } = serverFieldErrors(err.detail)
        setServerErrors(mapped)
        setGeneralErrors(general)
        requestAnimationFrame(() => summaryRef.current?.focus())
      } else {
        setGeneralErrors([err.message])
      }
      setSubmitting(false)
    }
  }

  const baseDone = BASE_FIELDS.length - state.baseMissing.length
  const vitalsDone = requiredSpecs.length - state.vitalsMissing.length
  const showSummary = attempted && (problemKeys.length > 0 || generalErrors.length > 0)

  const conditionGroups = schema.condition_options.reduce((groups, option) => {
    ;(groups[option.group] = groups[option.group] || []).push(option)
    return groups
  }, {})

  return (
    <div>
      <Link className="back-link reveal" to="/">
        <IconArrowLeft size={15} /> Patient panel
      </Link>

      <PageHero
        meta="New record"
        title="Add patient"
        subtitle="Base details are enough to add a patient. Add the four vitals as well and they're scored by the risk models and join the panel analytics."
      />

      <form className="intake-layout" onSubmit={handleSubmit} noValidate>
        <div className="intake-main">
          {showSummary && (
            <FormAlert
              innerRef={summaryRef}
              title={state.baseMissing.length > 0 ? "This patient can't be added yet" : 'Some values need fixing'}
              problemKeys={problemKeys}
              state={state}
              serverErrors={serverErrors}
              generalErrors={generalErrors}
              schema={schema}
              onJump={focusField}
            />
          )}

          <Card icon={IconUserPlus} title="Patient details" hint="The four required details are the minimum to add a patient.">
            <DetailsFields values={values} setValue={setValue} touch={touch} errorFor={errorFor} register={register} />
          </Card>

          <Card
            icon={IconFlask}
            title="Measurements"
            hint="What the risk models read. Record what you have; nothing here is needed just to add the patient."
          >
            <MeasurementFields
              schema={schema}
              measures={measures}
              setMeasure={setMeasure}
              measuredOn={values.measured_on}
              setMeasuredOn={(value) => setValue('measured_on', value)}
              touch={touch}
              errorFor={errorFor}
              register={register}
              state={state}
            />
          </Card>

          <Card icon={IconClipboard} title="History" hint="Optional. Existing diagnoses are read by the risk models.">
            {Object.entries(conditionGroups).map(([group, options]) => (
              <fieldset key={group} className="check-group">
                <legend>{group === 'Cardiometabolic' ? 'Cardiometabolic diagnoses' : 'Other chronic conditions'}</legend>
                <div className="check-grid">
                  {options.map((option) => {
                    const checked = conditions.includes(option.value)
                    return (
                      <label key={option.value} className={`check ${checked ? 'is-checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setConditions((prev) =>
                              checked ? prev.filter((value) => value !== option.value) : [...prev, option.value]
                            )
                          }
                        />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ))}

            <fieldset className="check-group">
              <legend>Active medications</legend>
              <MedicationInputs medications={medications} setMedications={setMedications} />
            </fieldset>
          </Card>
        </div>

        <aside className="readiness" aria-label="What adding this patient will do">
          <div className="readiness-block">
            <div className="readiness-head">
              <span>Patient details</span>
              <span className="mono">
                {baseDone} of {BASE_FIELDS.length}
              </span>
            </div>
            <ul className="readiness-list">
              {BASE_FIELDS.map((field) => (
                <ReadinessItem
                  key={field.key}
                  label={field.label}
                  done={!state.baseMissing.includes(field.key) && !state.errors[field.key]}
                  flagged={attempted}
                />
              ))}
            </ul>
          </div>

          <div className="readiness-block">
            <div className="readiness-head">
              <span>Risk assessment</span>
              <span className="mono">
                {vitalsDone} of {requiredSpecs.length}
              </span>
            </div>
            <ul className="readiness-list">
              {requiredSpecs.map((spec) => (
                <ReadinessItem
                  key={spec.key}
                  label={spec.label}
                  done={!state.vitalsMissing.includes(spec.key)}
                  detail={state.valid[spec.key] !== undefined ? String(state.valid[spec.key]) : null}
                />
              ))}
            </ul>
          </div>

          <div className="readiness-block">
            <div className="readiness-head">
              <span>Labs</span>
              <span>{state.estimated.length === 0 ? 'All entered' : `${state.estimated.length} estimated`}</span>
            </div>
            <ul className="readiness-list">
              {optionalSpecs.map((spec) => {
                const entered = state.valid[spec.key] !== undefined
                return (
                  <li key={spec.key} className={`readiness-item ${entered ? 'is-done' : 'is-estimated'}`}>
                    <span className="readiness-mark" aria-hidden="true">
                      {entered && <IconCheck size={12} strokeWidth={2.6} />}
                    </span>
                    <span className="readiness-label">{spec.label}</span>
                    <span className="readiness-detail mono">
                      {entered ? formatNumber(state.valid[spec.key]) : `≈ ${formatNumber(spec.estimate)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          <Outcome state={state} />

          <button type="submit" className="btn btn-primary readiness-submit" disabled={submitting}>
            <IconUserPlus size={15} />
            {submitting
              ? 'Adding…'
              : state.outcome === 'assessed'
                ? 'Add and assess patient'
                : state.outcome === 'unassessed'
                  ? 'Add without assessment'
                  : 'Add patient'}
          </button>
        </aside>
      </form>
    </div>
  )
}

/** Plain statement of what pressing the button will do right now. */
function Outcome({ state }) {
  if (state.outcome === 'blocked') {
    const missing = state.baseMissing.map((key) => BASE_FIELDS.find((field) => field.key === key).label.toLowerCase())
    return (
      <div className="outcome is-blocked" aria-live="polite">
        <div className="outcome-title">Can't be added yet</div>
        <p>
          {missing.length > 0
            ? `Still needs ${listPhrase(missing)}.`
            : `Fix the ${state.inputErrors.length === 1 ? 'highlighted value' : 'highlighted values'} first.`}
        </p>
      </div>
    )
  }
  if (state.outcome === 'unassessed') {
    return (
      <div className="outcome is-unassessed" aria-live="polite">
        <div className="outcome-title">Will be added without a risk assessment</div>
        <p>
          Not scored, and left out of panel analytics, until{' '}
          {state.vitalsMissing.length === 1 ? 'this vital is' : 'these vitals are'} recorded:{' '}
          {listPhrase(state.vitalsMissing.map((key) => VITAL_SHORT[key]))}.
        </p>
      </div>
    )
  }
  return (
    <div className="outcome is-assessed" aria-live="polite">
      <div className="outcome-title">Will be added and risk-assessed</div>
      <p>
        Scored on diabetes, hypertension and heart disease, and included in panel analytics.
        {state.estimated.length > 0 &&
          ` ${state.estimated.length} ${state.estimated.length === 1 ? 'lab' : 'labs'} will be estimated.`}
      </p>
    </div>
  )
}

export default AddPatient
