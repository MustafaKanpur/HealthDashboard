// Display names for the backend's clinical input keys, as they come back in
// a chart's missing_for_assessment and estimated_inputs. Same wording as the
// intake schema's labels.
export const MEASUREMENT_LABELS = {
  systolic_bp: 'Systolic blood pressure',
  diastolic_bp: 'Diastolic blood pressure',
  bmi: 'Body mass index',
  smoking_status: 'Smoking status',
  glucose: 'Glucose',
  total_cholesterol: 'Total cholesterol',
  hdl_cholesterol: 'HDL cholesterol',
  ldl_cholesterol: 'LDL cholesterol',
}

/** ['a', 'b', 'c'] -> "a, b and c" */
export function listPhrase(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// Lower-case a label for use mid-sentence, leaving acronyms alone
// ("Body mass index" -> "body mass index", but "HDL cholesterol" stays).
function midSentence(label) {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label
}

export function measurementPhrase(keys) {
  return listPhrase(keys.map((key) => midSentence(MEASUREMENT_LABELS[key] || key)))
}
