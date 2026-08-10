// Sample data for local dev/testing of the chart components in this
// directory only — not imported by the components themselves, and not
// wired into any page. Shapes match each component's documented props.

export const mockRiskGaugeScore = 62

export const mockRadarConditions = [
  { name: 'Diabetes', riskScore: 74 },
  { name: 'Hypertension', riskScore: 48 },
  { name: 'CVD', riskScore: 61 },
  { name: 'CKD', riskScore: 22 },
  { name: 'Obesity', riskScore: 55 },
]

export const mockShapValues = [
  { feature: 'Fasting glucose', value: 0.18 },
  { feature: 'BMI', value: 0.12 },
  { feature: 'Age', value: 0.09 },
  { feature: 'HDL cholesterol', value: -0.07 },
  { feature: 'Exercise frequency', value: -0.11 },
  { feature: 'Systolic BP', value: 0.06 },
  { feature: 'Smoking status', value: 0.04 },
]

export const mockVitalsTrend = [
  { date: '2025-02', value: 118, riskScore: 40, stdDev: 4 },
  { date: '2025-04', value: 122, riskScore: 45, stdDev: 5 },
  { date: '2025-06', value: 129, riskScore: 52, stdDev: 6 },
  { date: '2025-08', value: 134, riskScore: 58, stdDev: 5 },
  { date: '2025-10', value: 131, riskScore: 55, stdDev: 4 },
  { date: '2025-12', value: 138, riskScore: 63, stdDev: 6 },
]

export const mockSparklineValues = [82, 85, 88, 84, 90, 95, 99, 104]

export const mockPatientPanel = Array.from({ length: 60 }, (_, i) => ({
  riskScore: Math.round(Math.abs(Math.sin(i * 0.37) * 100)),
}))

export const mockScatterData = Array.from({ length: 40 }, (_, i) => {
  const x = 20 + Math.round((i * 61) % 60)
  const y = Math.round(Math.abs(Math.sin(i * 0.5) * 100))
  const tier = y > 66 ? 'high' : y >= 33 ? 'medium' : 'low'
  return { x, y, tier, patientId: `mock-${i}` }
})

export const mockAnomalyData = [
  { date: '2025-06-01', value: 95, isAnomaly: false },
  { date: '2025-06-08', value: 98, isAnomaly: false },
  { date: '2025-06-15', value: 101, isAnomaly: false },
  { date: '2025-06-22', value: 162, isAnomaly: true },
  { date: '2025-06-29', value: 104, isAnomaly: false },
  { date: '2025-07-06', value: 99, isAnomaly: false },
  { date: '2025-07-13', value: 41, isAnomaly: true },
  { date: '2025-07-20', value: 100, isAnomaly: false },
]
