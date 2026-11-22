import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatNumberId,
  formatDateId,
  formatDateTimeId,
  getAdminTxMeta,
  getRoleBadgeMeta,
  getStatusBadgeMeta
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
