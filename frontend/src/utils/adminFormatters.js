const ID_NUMBER_FORMATTER = new Intl.NumberFormat('id-ID')

const ID_DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

const ID_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

const DEFAULT_BADGE_CLASS = 'bg-[#f5f3eb] text-[#111111]'

const TX_META_MAP = {
  TOPUP: {
    label: 'Top-Up',
    badgeClass: 'bg-[#d8f3dc] text-[#111111]',
    amountPrefix: '+'
  },
  DEDUCTION: {
    label: 'Pemakaian',
    badgeClass: 'bg-[#ffcae6] text-[#111111]',
    amountPrefix: '-'
  },
  WELCOME_GRANT: {
    label: 'Bonus & Klaim',
    badgeClass: 'bg-[#fff099] text-[#111111]',
    amountPrefix: '+'
  },
  REFUND: {
    label: 'Pengembalian',
    badgeClass: 'bg-[#87d7ff] text-[#111111]',
    amountPrefix: '+'
  }
}

const ROLE_META_MAP = {
  ADMIN: {
    label: 'Admin',
    badgeClass: 'bg-[#fff099] text-[#111111]'
  },
  AUDIO_ENGINEER: {
    label: 'Audio Engineer',
    badgeClass: DEFAULT_BADGE_CLASS
  }
}

const STATUS_META_MAP = {
  ACTIVE: {
    label: 'Aktif',
    badgeClass: 'bg-[#d8f3dc] text-[#111111]'
  },
  SUSPENDED: {
    label: 'Ditangguhkan',
    badgeClass: 'bg-[#ffcae6] text-[#111111]'
  }
}

function formatWithDateFormatter(isoStr, formatter) {
  if (!isoStr) return '-'
  const date = new Date(isoStr)
  if (Number.isNaN(date.getTime())) return '-'
  return formatter.format(date)
}

function resolveBadgeMeta(map, key) {
  if (key && Object.hasOwn(map, key)) {
    return map[key]
  }
  return {
    label: key || '-',
    badgeClass: DEFAULT_BADGE_CLASS
  }
}

/**
 * Format numeric values into Indonesian locale grouping with a safe 0 fallback.
 */
export function formatNumberId(val) {
  if (val === null || val === undefined || val === '') {
    return ID_NUMBER_FORMATTER.format(0)
  }
  const numeric = Number(val)
  return ID_NUMBER_FORMATTER.format(Number.isFinite(numeric) ? numeric : 0)
}

/**
 * Format an ISO timestamp into a short Indonesian date string, returning '-' when empty or invalid.
 */
export function formatDateId(isoStr) {
  return formatWithDateFormatter(isoStr, ID_DATE_FORMATTER)
}

/**
 * Format an ISO timestamp into an Indonesian date-and-time string, returning '-' when empty or invalid.
 */
export function formatDateTimeId(isoStr) {
  return formatWithDateFormatter(isoStr, ID_DATE_TIME_FORMATTER)
}

/**
 * Map a token transaction enum type to its human-readable Indonesian label, v2 badge classes, and sign prefix.
 */
export function getAdminTxMeta(type) {
  if (type && Object.hasOwn(TX_META_MAP, type)) {
    return TX_META_MAP[type]
  }
  return {
    label: type || '-',
    badgeClass: DEFAULT_BADGE_CLASS,
    amountPrefix: ''
  }
}

/**
 * Map a user role enum to its display label and v2 badge classes.
 */
export function getRoleBadgeMeta(role) {
  return resolveBadgeMeta(ROLE_META_MAP, role)
}

/**
 * Map an account status enum to its Indonesian label and v2 badge classes.
 */
export function getStatusBadgeMeta(status) {
  return resolveBadgeMeta(STATUS_META_MAP, status)
}

/**
 * Determine whether a token transaction represents a debit/outflow.
 */
export function isTxDebit(tx) {
  return Boolean(tx && (tx.type === 'DEDUCTION' || Number(tx.amount || 0) < 0))
}

/**
 * Return high-contrast text color class for a transaction amount (neutral slate for 0).
 */
export function getTxAmountClass(tx) {
  const raw = Number(tx?.amount || 0)
  if (!Number.isFinite(raw) || raw === 0) return 'text-[#60605e]'
  return isTxDebit(tx) ? 'text-[#be123c]' : 'text-[#15803d]'
}

/**
 * Format a transaction amount with sign ('+'/'-') or '0' without sign when zero.
 */
export function formatTxSignedAmount(tx) {
  const raw = Number(tx?.amount || 0)
  if (!Number.isFinite(raw) || raw === 0) return '0'
  const sign = isTxDebit(tx) ? '-' : (getAdminTxMeta(tx?.type).amountPrefix || '+')
  return `${sign}${formatNumberId(Math.abs(raw))}`
}
