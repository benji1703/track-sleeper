// Evidence-based sleep guidance by age. Medically reviewed content — do not
// improvise values; update only from the cited sources below.

export interface AgeSleepInfo {
  label: string // e.g. '3–6 months'
  minMonths: number
  maxMonths: number | null
  wakeWindow: string // e.g. '1.5–2.5 hours'
  napsPerDay: string // e.g. '3–4 naps (2.5–4h total day sleep)'
  nightSleep: string // e.g. '10–11 hours, often with feeds'
  total24h: string // e.g. '12–16 hours (AASM)'
  notes: string // 1–2 sentences practical guidance
}

export const SLEEP_SOURCES: { label: string; url: string }[] = [
  {
    label: 'AASM consensus: recommended sleep for pediatric populations (Paruthi et al., 2016)',
    url: 'https://jcsm.aasm.org/doi/10.5664/jcsm.5866',
  },
  {
    label: 'National Sleep Foundation sleep duration recommendations (Hirshkowitz et al., 2015)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/29073412/',
  },
  {
    label: 'Sleep duration percentiles from infancy to adolescence (Iglowstein et al., Pediatrics 2003)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/12563055/',
  },
  {
    label: 'Normal sleep patterns in infants and children: meta-analysis (Galland et al., 2012)',
    url: 'https://pubmed.ncbi.nlm.nih.gov/21930409/',
  },
  {
    label: 'AAP — healthy sleep habits',
    url: 'https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/default.aspx',
  },
  {
    label: 'NHS — helping your baby to sleep',
    url: 'https://www.nhs.uk/conditions/baby/caring-for-a-newborn/helping-your-baby-to-sleep/',
  },
  {
    label: 'Huckleberry — 3 month sleep guide',
    url: 'https://huckleberrycare.com/age-guides/3-months',
  },
]

export const WAKE_WINDOW_CAVEAT =
  'Wake windows are practical guidance popularised by paediatric sleep specialists, not a clinical standard — the linked studies cover total sleep needs. Every baby varies; treat these as starting points.'

const AGE_SLEEP_INFO: AgeSleepInfo[] = [
  {
    label: '0–3 months',
    minMonths: 0,
    maxMonths: 3,
    wakeWindow: '45–90 minutes',
    napsPerDay: '4–5 naps (3–5h total day sleep)',
    nightSleep: '8–9 hours, fragmented by feeds',
    total24h: '14–17 hours (National Sleep Foundation)',
    notes:
      'Newborn sleep is irregular; day/night rhythm develops around 8–12 weeks. Watch for tired signs (yawning, fussing, staring off) rather than the clock.',
  },
  {
    label: '3 months',
    minMonths: 3,
    maxMonths: 4,
    wakeWindow: '60–120 minutes (shorter in the morning, longer before bedtime)',
    napsPerDay: '4–5 naps',
    nightSleep: '10–12 hours, one or more night feeds are still common',
    total24h: '14–17 hours (Huckleberry)',
    notes:
      'Sleep architecture is maturing, which can bring more noticeable night wake-ups as sleep cycles organize. Naps become more predictable through the month, typically 30 minutes to 1.5 hours each.',
  },
  {
    label: '4–6 months',
    minMonths: 4,
    maxMonths: 6,
    wakeWindow: '1.5–2.5 hours',
    napsPerDay: '3–4 naps (2.5–4h total day sleep)',
    nightSleep: '10–11 hours, night feeds are still normal',
    total24h: '12–16 hours (AASM, for 4–12 months)',
    notes:
      'Sleep begins to consolidate; many babies settle into a more predictable nap rhythm toward 5–6 months.',
  },
  {
    label: '6–9 months',
    minMonths: 6,
    maxMonths: 9,
    wakeWindow: '2–3 hours',
    napsPerDay: '2–3 naps (2–3.5h total day sleep)',
    nightSleep: '10–12 hours',
    total24h: '12–16 hours (AASM)',
    notes:
      'Most babies drop to 2 naps in this window. The last wake window of the day is usually the longest.',
  },
  {
    label: '9–12 months',
    minMonths: 9,
    maxMonths: 12,
    wakeWindow: '2.5–3.5 hours',
    napsPerDay: '2 naps (2–3h total day sleep)',
    nightSleep: '10–12 hours',
    total24h: '12–16 hours (AASM)',
    notes:
      'A brief nap regression around 8–10 months is common and usually passes without schedule changes.',
  },
  {
    label: '12–18 months',
    minMonths: 12,
    maxMonths: 18,
    wakeWindow: '3–4 hours',
    napsPerDay: '1–2 naps (1.5–3h total day sleep)',
    nightSleep: '10–12 hours',
    total24h: '11–14 hours (AASM, for 1–2 years)',
    notes: 'The 2→1 nap transition typically happens between 13 and 18 months.',
  },
  {
    label: '18mo+',
    minMonths: 18,
    maxMonths: null,
    wakeWindow: '4–6 hours',
    napsPerDay: '1 nap (1–2.5h)',
    nightSleep: '10–12 hours',
    total24h: '11–14 hours (AASM)',
    notes:
      'One early-afternoon nap is typical until age 3–4. Guard the nap from starting too late — it can push bedtime.',
  },
]

export function sleepInfoForAge(ageMonths: number): AgeSleepInfo {
  const match = AGE_SLEEP_INFO.find(
    (entry) => ageMonths >= entry.minMonths && (entry.maxMonths === null || ageMonths < entry.maxMonths)
  )
  return match ?? AGE_SLEEP_INFO[AGE_SLEEP_INFO.length - 1]
}
