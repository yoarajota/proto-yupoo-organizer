type MissionErrorInput = {
  code?: string | null
  message?: string | null
}

type DiagnosticsItem = {
  label: string
  value: string
}

const statusLabels: Record<string, string> = {
  created: 'Ready to scrape',
  discovery_queued: 'Waiting to scrape',
  scanning: 'Scraping shop',
  classification_queued: 'Waiting to classify',
  classifying_categories: 'Classifying categories',
  matching_queued: 'Waiting to match suppliers',
  matching: 'Matching suppliers',
  suggestions_ready: 'Outreach suggestions ready',
  outreach_queued: 'Waiting to draft outreach',
  awaiting_approval: 'Waiting for approval',
  approved_for_outreach: 'Approved for outreach',
  replies_received: 'Replies received',
  parse_queued: 'Waiting to read replies',
  offers_normalized: 'Offers extracted',
  completed: 'Scrape complete',
  blocked_needs_input: 'Needs input',
  failed_retrying: 'Retry scheduled',
  failed_terminal: 'Needs review',
}

const stageLabels: Record<string, string> = {
  discovery: 'Scrape discovery',
  classifying_categories: 'Category classification',
  matching: 'Supplier matching',
  suggestion_generation: 'Outreach drafting',
  parse: 'Reply parsing',
}

const eventLabels: Record<string, string> = {
  worker_received: 'Worker received the job',
  worker_started: 'Worker started',
  worker_succeeded: 'Worker finished successfully',
  worker_failed: 'Worker stopped with an error',
  worker_discovery_started: 'Scrape started',
  worker_discovery_fetch_started: 'Fetching source pages',
  worker_discovery_extracted: 'Source pages parsed',
  worker_discovery_pruned: 'Old category results cleaned up',
  worker_discovery_categories_saved: 'Categories saved',
  worker_discovery_suppliers_saved: 'Suppliers saved',
  worker_discovery_finished: 'Scrape finished',
}

function titleCaseToken(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const acronym = part.toUpperCase()
      if (['HTML', 'HTTP', 'ID', 'JSON', 'SSL', 'URL'].includes(acronym)) return acronym
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function cleanTechnicalMessage(message: string) {
  return message
    .split('\n')
    .filter((line) => !line.trim().startsWith('at '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatHttpError(status: string) {
  const httpMessages: Record<string, string> = {
    '400': 'The source rejected the request.',
    '401': 'The source requires sign-in before it can be scraped.',
    '403': 'The source blocked access to this page.',
    '404': 'The source page was not found.',
    '408': 'The source took too long to respond.',
    '429': 'The source is rate limiting requests. Try again later.',
    '500': 'The source returned a server error.',
    '502': 'The source gateway failed while loading the page.',
    '503': 'The source is temporarily unavailable.',
    '504': 'The source timed out before responding.',
    '522': 'The source connection timed out.',
    '524': 'The source started responding but timed out.',
    '525': 'The source SSL connection failed.',
  }

  return httpMessages[status] ?? `The source returned HTTP ${status}.`
}

export function formatMissionStatusLabel(status: string) {
  return statusLabels[status] ?? titleCaseToken(status)
}

export function formatMissionStageLabel(stage: string | null | undefined) {
  if (!stage) return 'No stage selected'
  return stageLabels[stage] ?? titleCaseToken(stage)
}

export function formatMissionEventLabel(eventName: string) {
  return eventLabels[eventName] ?? titleCaseToken(eventName)
}

export function formatMissionError({ code, message }: MissionErrorInput) {
  const cleanedMessage = message ? cleanTechnicalMessage(message) : ''
  const httpMatch = cleanedMessage.match(/^HTTP\s+(\d{3})$/i)

  if (httpMatch?.[1]) {
    return {
      title: 'Source request failed',
      detail: formatHttpError(httpMatch[1]),
    }
  }

  if (/fetch failed/i.test(cleanedMessage)) {
    return {
      title: 'Source could not be reached',
      detail: 'The scraper could not connect to the source. Check the URL and try again.',
    }
  }

  if (/operation was aborted|aborterror/i.test(cleanedMessage)) {
    return {
      title: 'Source request timed out',
      detail: 'The source did not respond before the scraper stopped waiting.',
    }
  }

  if (/Every Yupoo discovery request failed/i.test(cleanedMessage)) {
    return {
      title: 'No source pages could be scraped',
      detail: 'Every request to the Yupoo shop failed. Check whether the shop is online, blocked, or requires sign-in.',
    }
  }

  if (/Only scrape discovery and classification missions are supported/i.test(cleanedMessage)) {
    return {
      title: 'Unsupported mission step',
      detail: 'This worker only supports scraping and category classification right now.',
    }
  }

  if (/Invalid mission status transition/i.test(cleanedMessage)) {
    return {
      title: 'Mission status conflict',
      detail: 'The mission moved through an unexpected status path. Refresh the page before retrying.',
    }
  }

  if (cleanedMessage) {
    return {
      title: code ? titleCaseToken(code) : 'Mission needs review',
      detail: cleanedMessage,
    }
  }

  if (code) {
    return {
      title: titleCaseToken(code),
      detail: 'The mission stopped before a detailed reason was recorded.',
    }
  }

  return {
    title: 'Mission needs review',
    detail: 'The mission stopped before a detailed reason was recorded.',
  }
}

function formatDiagnosticsValue(value: unknown): string {
  if (value === null || value === undefined) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Intl.NumberFormat('en').format(value)
  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const url = new URL(value)
        return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`
      } catch {
        return value
      }
    }
    return titleCaseToken(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None'
    return `${Intl.NumberFormat('en').format(value.length)} item${value.length === 1 ? '' : 's'}`
  }
  return 'Details recorded'
}

export function formatMissionDiagnostics(value: unknown): DiagnosticsItem[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []

  return Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([key, entryValue]) => ({
      label: titleCaseToken(key.replace(/_count$/, '')),
      value: key === 'message' && typeof entryValue === 'string'
        ? formatMissionError({ message: entryValue }).detail
        : formatDiagnosticsValue(entryValue),
    }))
}
