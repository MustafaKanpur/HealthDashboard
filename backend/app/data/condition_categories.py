"""Heuristic categorization of Synthea condition descriptions for chart
display. This is a first-match-wins keyword taxonomy, not an authoritative
ICD/SNOMED classification — good enough to group a patient's condition list
into sensible sections in the UI.
"""

# (category, keywords) — checked in order, first match wins.
CATEGORY_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Diabetes", ["diabet"]),
    ("Hypertension", ["hypertension"]),
    (
        "Heart Disease",
        ["coronary heart disease", "myocardial infarction", "cardiac arrest", "heart failure", "injury of heart"],
    ),
    (
        "Other Chronic Conditions",
        [
            "hyperlipidemia",
            "hypertriglyceridemia",
            "metabolic syndrome",
            "obesity",
            "osteoporosis",
            "osteoarthritis",
            "anemia",
            "chronic sinusitis",
            "chronic low back pain",
            "chronic neck pain",
            "stroke",
            "seizure",
            "migraine",
            "asthma",
            "emphysema",
        ],
    ),
    ("Mental Health", ["anxiety", "depression", "panic", "ptsd"]),
    ("Injury", ["fracture", "sprain", "laceration", "concussion", "whiplash", "wound"]),
    (
        "Acute/Infectious",
        [
            "viral",
            "bacterial",
            "sinusitis",
            "pharyngitis",
            "bronchitis",
            "covid",
            "otitis",
            "streptococc",
            "appendicitis",
            "fever",
            "cough",
        ],
    ),
    ("Reproductive", ["pregnan", "miscarriage"]),
    (
        "Social/Behavioral",
        [
            "employment",
            "stress",
            "isolation",
            "housing",
            "criminal record",
            "transport",
            "refugee",
            "education",
            "labor force",
            "abuse",
            "violence",
            "alcohol",
            "drug",
            "risk activity",
        ],
    ),
]

FALLBACK_CATEGORY = "Other"

CATEGORY_NAMES = [name for name, _ in CATEGORY_KEYWORDS] + [FALLBACK_CATEGORY]


def categorize(description: str) -> str:
    lowered = description.lower()
    for category, keywords in CATEGORY_KEYWORDS:
        if any(keyword in lowered for keyword in keywords):
            return category
    return FALLBACK_CATEGORY
