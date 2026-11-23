import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatNumberId,
  formatDateId,
  formatDateTimeId,
  getAdminTxMeta,
  getRoleBadgeMeta,
  getStatusBadgeMeta,
  isTxDebit,
  getTxAmountClass,
  formatTxSignedAmount
} from '../src/utils/adminFormatters.js'

test('formatNumberId memformat angka lokal Indonesia dan fallback 0', () => {
  assert.equal(formatNumberId(12500), '12.500')
  assert.equal(formatNumberId('12500'), '12.500')
  assert.equal(formatNumberId(null), '0')
  assert.equal(formatNumberId(undefined), '0')
})

test('formatDateId dan formatDateTimeId menangani tanggal valid serta kosong', () => {
  assert.equal(formatDateId(null), '-')
  assert.equal(formatDateId('not-a-date'), '-')
  assert.equal(formatDateTimeId(''), '-')
  assert.equal(formatDateTimeId('invalid'), '-')
  assert.match(formatDateId('2026-11-03T08:15:00.000Z'), /2026/)
  assert.match(formatDateTimeId('2026-11-03T08:15:00.000Z'), /2026/)
})

test('getAdminTxMeta memetakan enum transaksi ke label bahasa Indonesia manusiawi', () => {
  assert.deepEqual(getAdminTxMeta('TOPUP'), {
    label: 'Top-Up',
    badgeClass: 'bg-[#d8f3dc] text-[#111111]',
    amountPrefix: '+'
  })
  assert.deepEqual(getAdminTxMeta('DEDUCTION'), {
    label: 'Pemakaian',
    badgeClass: 'bg-[#ffcae6] text-[#111111]',
    amountPrefix: '-'
  })
  assert.deepEqual(getAdminTxMeta('WELCOME_GRANT'), {
    label: 'Bonus & Klaim',
    badgeClass: 'bg-[#fff099] text-[#111111]',
    amountPrefix: '+'
  })
  assert.deepEqual(getAdminTxMeta('REFUND'), {
    label: 'Pengembalian',
    badgeClass: 'bg-[#87d7ff] text-[#111111]',
    amountPrefix: '+'
  })
  assert.equal(getAdminTxMeta('UNKNOWN').label, 'UNKNOWN')
  assert.equal(getAdminTxMeta('UNKNOWN').amountPrefix, '')
})

test('getRoleBadgeMeta dan getStatusBadgeMeta memetakan peran dan status dengan label jelas', () => {
  assert.equal(getRoleBadgeMeta('ADMIN').label, 'Admin')
  assert.equal(getRoleBadgeMeta('AUDIO_ENGINEER').label, 'Audio Engineer')
  assert.deepEqual(getStatusBadgeMeta('ACTIVE'), {
    label: 'Aktif',
    badgeClass: 'bg-[#d8f3dc] text-[#111111]'
  })
  assert.deepEqual(getStatusBadgeMeta('SUSPENDED'), {
    label: 'Ditangguhkan',
    badgeClass: 'bg-[#ffcae6] text-[#111111]'
  })
})

test('isTxDebit, getTxAmountClass, dan formatTxSignedAmount menangani debit, kredit, dan nol secara konsisten', () => {
  assert.equal(isTxDebit({ type: 'DEDUCTION', amount: -10 }), true)
  assert.equal(isTxDebit({ type: 'DEDUCTION', amount: 10 }), true)
  assert.equal(isTxDebit({ type: 'REFUND', amount: -5 }), true)
  assert.equal(isTxDebit({ type: 'TOPUP', amount: 25 }), false)
  assert.equal(isTxDebit({ type: 'TOPUP', amount: 0 }), false)
  assert.equal(isTxDebit(null), false)

  assert.equal(getTxAmountClass({ type: 'TOPUP', amount: 25 }), 'text-[#15803d]')
  assert.equal(getTxAmountClass({ type: 'DEDUCTION', amount: -10 }), 'text-[#be123c]')
  assert.equal(getTxAmountClass({ type: 'TOPUP', amount: 0 }), 'text-[#60605e]')
  assert.equal(getTxAmountClass({ type: 'DEDUCTION', amount: 0 }), 'text-[#60605e]')

  assert.equal(formatTxSignedAmount({ type: 'TOPUP', amount: 1250 }), '+1.250')
  assert.equal(formatTxSignedAmount({ type: 'DEDUCTION', amount: -10 }), '-10')
  assert.equal(formatTxSignedAmount({ type: 'DEDUCTION', amount: 10 }), '-10')
  assert.equal(formatTxSignedAmount({ type: 'TOPUP', amount: 0 }), '0')
  assert.equal(formatTxSignedAmount({ type: 'DEDUCTION', amount: 0 }), '0')
})
