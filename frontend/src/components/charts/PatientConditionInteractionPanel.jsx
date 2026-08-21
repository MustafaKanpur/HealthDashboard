import { CONDITION_LABELS } from './chartTheme.js'

function joinConditions(conditions) {
  const labels = conditions.map((condition) => CONDITION_LABELS[condition] || condition)
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`
}

/** Lists this patient's compounding risk factors — features that are top
 * SHAP contributors to more than one of their elevated conditions at once. */
function PatientConditionInteractionPanel({ patientId, interactions }) {
  if (!interactions || interactions.length === 0) {
    return (
      <p className="empty-state">
        No compounding risk factors identified between this patient's elevated conditions.
      </p>
    )
  }

  return (
    <ul className="interaction-list" data-patient-id={patientId}>
      {interactions.map((interaction, index) => (
        <li className="interaction-card" key={index}>
          <p>
            Elevated <strong>{interaction.sharedFactor}</strong> is contributing to both{' '}
            {joinConditions(interaction.conditions)} risk for this patient.
          </p>
          <span className="interaction-contribution mono">+{interaction.contribution.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  )
}

export default PatientConditionInteractionPanel
