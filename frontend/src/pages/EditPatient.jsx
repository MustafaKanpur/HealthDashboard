import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getIntakeSchema, getPatient, updatePatient } from '../api/client.js'
import { IconArrowLeft, IconClipboard, IconFlask, IconPill, IconUserPlus } from '../icons.jsx'
import PageHero from '../components/ui/PageHero.jsx'
import Card from '../components/ui/Card.jsx'
import { usePageTitle } from '../components/ui/pageTitle.jsx'
import {
  BASE_FIELDS,
  DetailsFields,
  FormAlert,
  IntakeSkeleton,
  MODEL_CATEGORIES,
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

const DETAIL_KEYS = ['first_name', 'last_name', 'birthdate', 'sex', 'race', 'ethnicity', 'marital_status', 'city', 'state']
const DETAIL_LABELS = {
  first_name: 'first name',
  last_name: 'last name',
  birthdate: 'date of birth',
  sex: 'sex',
  race: 'race',
  ethnicity: 'ethnicity',
  marital_status: 'marital status',
  city: 'city',
  state: 'state',
}

function initialValuesFor(patient) {
  const values = { measured_on: todayIso() }
  for (const key of DETAIL_KEYS) values[key] = patient[key] ?? ''
  return values
}

/** Latest value on record for each model input, keyed like the schema. */
function onFileFor(patient) {
  const onFile = {}
  for (const lab of patient.labs) onFile[lab.key] = { value: lab.value, date: lab.observed_on }
  if (patient.smoking_status) onFile.smoking_status = { value: patient.smoking_status, date: patient.smoking_observed_on }
  return onFile
}

function unique(items) {
  return [...new Set(items)]
}

function EditPatient() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const [patient, setPatient] = useState(null)
  const [schema, setSchema] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const [values, setValues] = useState(null)
  const [measures, setMeasures] = useState({})
  const [removeConditions, setRemoveConditions] = useState([])
  const [addConditions, setAddConditions] = useState([])
  const [stopMedications, setStopMedications] = useState([])
  const [newMedications, setNewMedications] = useState([''])

  const [touched, setTouched] = useState({})
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [generalErrors, setGeneralErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const fieldRefs = useRef({})
  const summaryRef = useRef(null)

  usePageTitle(patient ? `Editing ${patient.name}` : null)

  useEffect(() => {
    let cancelled = false
    Promise.all([getPatient(patientId), getIntakeSchema()])
      .then(([patientData, schemaData]) => {
        if (cancelled) return
        setPatient(patientData)
        setSchema(schemaData)
        setValues(initialValuesFor(patientData))
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  // Arriving from "Record vitals" on an unassessed chart: go straight there.
  useEffect(() => {
    if (schema && location.hash === '#measurements') {
      document.getElementById('measurements')?.scrollIntoView({ block: 'start' })
      fieldRefs.current.systolic_bp?.focus({ preventScroll: true })
    }
  }, [schema, location.hash])

  const onFile = useMemo(() => (patient ? onFileFor(patient) : {}), [patient])
  const state = useMemo(
    () => (schema && values ? evaluate(values, measures, schema, onFile) : null),
    [values, measures, schema, onFile]
  )

  if (loadError) return <div className="error-banner">Couldn't load this patient: {loadError}</div>
  if (!patient || !schema || !state) return <IntakeSkeleton />

  const initial = initialValuesFor(patient)
  const requiredSpecs = schema.measurements.filter((spec) => spec.required_for_assessment)

  const modelDiagnoses = unique(
    patient.conditions.filter((condition) => MODEL_CATEGORIES.has(condition.category)).map((c) => c.description)
  )
  const categoryOf = Object.fromEntries(patient.conditions.map((c) => [c.description, c.category]))
  const addableConditions = schema.condition_options.filter((option) => !modelDiagnoses.includes(option.value))
  const activeMedications = unique(patient.medications.filter((m) => m.active).map((m) => m.description))

  // --- what would change ---------------------------------------------------
  const changedDetails = DETAIL_KEYS.filter((key) => String(values[key]).trim() !== String(initial[key]).trim())
  const readingKeys = Object.keys(state.valid)
  const medicationsToAdd = unique(newMedications.map((name) => name.trim()).filter(Boolean))
  const changeLines = [
    changedDetails.length > 0 && `Correct ${listPhrase(changedDetails.map((key) => DETAIL_LABELS[key]))}`,
    readingKeys.length > 0 && `New reading: ${readingKeys.length} ${readingKeys.length === 1 ? 'value' : 'values'}`,
    addConditions.length > 0 && `Add ${addConditions.length} ${addConditions.length === 1 ? 'diagnosis' : 'diagnoses'}`,
    removeConditions.length > 0 &&
      `Remove ${removeConditions.length} ${removeConditions.length === 1 ? 'diagnosis' : 'diagnoses'}`,
    stopMedications.length > 0 &&
      `Stop ${stopMedications.length} ${stopMedications.length === 1 ? 'medication' : 'medications'}`,
    medicationsToAdd.length > 0 &&
      `Start ${medicationsToAdd.length} ${medicationsToAdd.length === 1 ? 'medication' : 'medications'}`,
  ].filter(Boolean)
  const dirty = changeLines.length > 0

  // --- field plumbing (same contract as the add form) -----------------------
  const errorFor = (key) => {
    if (serverErrors[key]) return serverErrors[key]
    if (state.errors[key] && (touched[key] || attempted)) return state.errors[key]
    if (state.baseMissing.includes(key) && (touched[key] || attempted)) return "Required: a patient can't be without it"
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
  const toggleIn = (setter, value) => setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  const problemKeys = problemKeysFor(state, serverErrors, schema)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    setGeneralErrors([])
    if (state.outcome === 'blocked') {
      requestAnimationFrame(() => {
        if (problemKeys[0]) focusField(problemKeys[0])
      })
      return
    }
    if (!dirty) return

    const optional = (value) => (String(value).trim() ? String(value).trim() : null)
    const payload = {
      details: {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        birthdate: values.birthdate,
        sex: values.sex,
        race: values.race || null,
        ethnicity: values.ethnicity || null,
        marital_status: values.marital_status || null,
        city: optional(values.city),
        state: optional(values.state),
      },
      new_reading: readingKeys.length > 0 ? { measured_on: values.measured_on || null, measurements: state.valid } : null,
      add_conditions: addConditions,
      remove_conditions: removeConditions,
      add_medications: medicationsToAdd,
      stop_medications: stopMedications,
    }

    setSubmitting(true)
    try {
      const updated = await updatePatient(patient.id, payload)
      navigate(`/patients/${patient.id}`, {
        state: { justEdited: { nowAssessed: !patient.risk_assessed && updated.risk_assessed } },
      })
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

  const showSummary = attempted && (problemKeys.length > 0 || generalErrors.length > 0)
  const vitalsDone = requiredSpecs.length - state.vitalsMissing.length
  const becomesAssessed = !patient.risk_assessed && state.outcome === 'assessed'

  return (
    <div>
      <Link className="back-link reveal" to={`/patients/${patient.id}`}>
        <IconArrowLeft size={15} /> Back to chart
      </Link>

      <PageHero
        meta={patient.source === 'user' ? 'Added record' : 'Synthea record'}
        title={`Edit ${patient.name}`}
        subtitle="Correct details in place. Measurements are recorded as a new dated reading, so earlier values stay in the history."
      />

      {patient.source !== 'user' && (
        <p className="source-note">
          This record comes from the Synthea export. Edits are stored alongside it and applied on top; the export
          itself is never modified. Changes here move this patient's scores and the panel analytics built on them.
        </p>
      )}

      <form className="intake-layout" onSubmit={handleSubmit} noValidate>
        <div className="intake-main">
          {showSummary && (
            <FormAlert
              innerRef={summaryRef}
              title="These changes can't be saved yet"
              problemKeys={problemKeys}
              state={state}
              serverErrors={serverErrors}
              generalErrors={generalErrors}
              schema={schema}
              onJump={focusField}
            />
          )}

          <Card icon={IconUserPlus} title="Patient details" hint="Corrections replace what's on record.">
            <DetailsFields values={values} setValue={setValue} touch={touch} errorFor={errorFor} register={register} />
          </Card>

          <div id="measurements">
            <Card icon={IconFlask} title="New reading" hint="Only what you enter is recorded; blank fields keep the latest on file.">
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
                onFile={onFile}
                editing
              />
            </Card>
          </div>

          <Card
            icon={IconClipboard}
            title="Diagnoses"
            hint="The diagnoses the risk models read. Other chart entries (injuries, acute illness, social findings) don't affect scores."
          >
            {modelDiagnoses.length > 0 ? (
              <ul className="record-list">
                {modelDiagnoses.map((description) => {
                  const marked = removeConditions.includes(description)
                  return (
                    <li key={description} className={`record-row ${marked ? 'is-marked' : ''}`}>
                      <div>
                        <div className="record-name">{description}</div>
                        <div className="record-meta">{marked ? 'Will be removed as entered in error' : categoryOf[description]}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-pressed={marked}
                        onClick={() => toggleIn(setRemoveConditions, description)}
                      >
                        {marked ? 'Undo' : 'Remove'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-state">None on record.</p>
            )}

            <fieldset className="check-group record-add">
              <legend>Add a diagnosis</legend>
              <div className="check-grid">
                {addableConditions.map((option) => {
                  const checked = addConditions.includes(option.value)
                  return (
                    <label key={option.value} className={`check ${checked ? 'is-checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleIn(setAddConditions, option.value)} />
                      {option.label}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </Card>

          <Card icon={IconPill} title="Medications" hint="Stopping keeps the course in the history with today as its end date.">
            {activeMedications.length > 0 ? (
              <ul className="record-list">
                {activeMedications.map((description) => {
                  const marked = stopMedications.includes(description)
                  return (
                    <li key={description} className={`record-row ${marked ? 'is-marked' : ''}`}>
                      <div>
                        <div className="record-name">{description}</div>
                        <div className="record-meta">{marked ? `Will be stopped ${todayIso()}` : 'Active'}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        aria-pressed={marked}
                        onClick={() => toggleIn(setStopMedications, description)}
                      >
                        {marked ? 'Undo' : 'Stop'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="empty-state">No active medications.</p>
            )}
            <fieldset className="check-group record-add">
              <legend>Start a medication</legend>
              <MedicationInputs medications={newMedications} setMedications={setNewMedications} />
            </fieldset>
          </Card>
        </div>

        <aside className="readiness" aria-label="What saving these changes will do">
          <div className="readiness-block">
            <div className="readiness-head">
              <span>Patient details</span>
              <span className="mono">
                {BASE_FIELDS.length - state.baseMissing.length} of {BASE_FIELDS.length}
              </span>
            </div>
            <ul className="readiness-list">
              {BASE_FIELDS.map((field) => (
                <ReadinessItem
                  key={field.key}
                  label={field.label}
                  done={!state.baseMissing.includes(field.key) && !state.errors[field.key]}
                  flagged
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
              {requiredSpecs.map((spec) => {
                const entered = state.valid[spec.key]
                const kept = onFile[spec.key]
                const shown = entered ?? kept?.value
                return (
                  <ReadinessItem
                    key={spec.key}
                    label={spec.label}
                    done={!state.vitalsMissing.includes(spec.key)}
                    detail={
                      shown === undefined
                        ? null
                        : `${entered !== undefined ? 'new ' : ''}${typeof shown === 'number' ? formatNumber(shown) : shown}`
                    }
                  />
                )
              })}
            </ul>
          </div>

          <div className="readiness-block">
            <div className="readiness-head">
              <span>Changes</span>
              <span className="mono">{changeLines.length}</span>
            </div>
            {dirty ? (
              <ul className="change-list">
                {changeLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="readiness-empty">No changes yet.</p>
            )}
          </div>

          <EditOutcome state={state} dirty={dirty} wasAssessed={patient.risk_assessed} becomesAssessed={becomesAssessed} />

          <button type="submit" className="btn btn-primary readiness-submit" disabled={submitting || !dirty}>
            {submitting ? 'Saving…' : becomesAssessed ? 'Save and assess' : 'Save changes'}
          </button>
        </aside>
      </form>
    </div>
  )
}

function EditOutcome({ state, dirty, wasAssessed, becomesAssessed }) {
  if (state.outcome === 'blocked') {
    const missing = state.baseMissing.map((key) => BASE_FIELDS.find((field) => field.key === key).label.toLowerCase())
    return (
      <div className="outcome is-blocked" aria-live="polite">
        <div className="outcome-title">Can't be saved yet</div>
        <p>
          {missing.length > 0
            ? `A patient can't be without ${listPhrase(missing)}.`
            : `Fix the ${state.inputErrors.length === 1 ? 'highlighted value' : 'highlighted values'} first.`}
        </p>
      </div>
    )
  }
  if (!dirty) {
    return (
      <div className="outcome" aria-live="polite">
        <div className="outcome-title">Nothing to save yet</div>
        <p>Make a change and it will be listed above.</p>
      </div>
    )
  }
  if (becomesAssessed) {
    return (
      <div className="outcome is-assessed" aria-live="polite">
        <div className="outcome-title">Will be risk-assessed on save</div>
        <p>With these vitals the patient is scored on all three conditions and joins panel analytics.</p>
      </div>
    )
  }
  if (state.outcome === 'unassessed') {
    return (
      <div className="outcome is-unassessed" aria-live="polite">
        <div className="outcome-title">Saved without a risk assessment</div>
        <p>Still missing: {listPhrase(state.vitalsMissing.map((key) => VITAL_SHORT[key]))}.</p>
      </div>
    )
  }
  return (
    <div className="outcome is-assessed" aria-live="polite">
      <div className="outcome-title">Will be saved and re-scored</div>
      <p>
        {wasAssessed
          ? "This patient's scores and the panel analytics update with these changes."
          : 'The patient is scored and joins panel analytics.'}
      </p>
    </div>
  )
}

export default EditPatient
