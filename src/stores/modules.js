import { defineStore } from 'pinia'
import { ref } from 'vue'

const initialData = {
  customers: [
    { id: 'CUS-001', name: 'Samuel Tesfaye', phone: '+251 911 000 101', idNumber: 'ET-008142', kycStatus: 'Verified', riskLevel: 'Low' },
    { id: 'CUS-002', name: 'Hana Bekele', phone: '+251 911 000 102', idNumber: 'ET-008143', kycStatus: 'Review required', riskLevel: 'Medium' },
  ],
  rates: [
    { id: 'RATE-01', currency: 'USD', buyRate: 156.8, sellRate: 157.42, effectiveDate: '2026-10-12', status: 'Active' },
    { id: 'RATE-02', currency: 'EUR', buyRate: 170.4, sellRate: 171.18, effectiveDate: '2026-10-12', status: 'Active' },
  ],
  inventory: [{ id: 'LOT-USD-21', lot: 'LOT-USD-21', currency: 'USD', acquired: 15000, remaining: 11200, unitCost: 155.9 }],
  reversals: [{ id: 'REV-008', reference: 'TR-1038', reason: 'Incorrect customer amount', requestedBy: 'Mulugeta T.', status: 'Pending approval' }],
  accounting: [{ id: 'JRN-9011', reference: 'JRN-9011', date: '2026-10-12', account: 'FX Cash - USD', debit: 314840, credit: 0, status: 'Posted' }],
  compliance: [{ id: 'AML-021', caseId: 'AML-021', customer: 'Hana Bekele', alert: 'Transaction pattern review', riskLevel: 'Medium', owner: 'Nardos K.', status: 'Open' }],
  'decision-management': [{ id: 'RULE-004', name: 'High value FX review', condition: 'transaction.amount > configured_limit', outcome: 'REVIEW', priority: 10, status: 'Draft' }],
  audit: [{ id: 'AUD-5102', timestamp: '2026-10-12 09:41', actor: 'Aster Admin', action: 'RATE_APPROVED', entity: 'RATE-01', result: 'Success' }],
  users: [
    { id: 'USR-001', name: 'Aster Admin', username: 'admin.demo', role: 'System Administrator', branch: 'Head Office', status: 'Active' },
    { id: 'USR-002', name: 'Mulugeta T.', username: 'teller.demo', role: 'Teller', branch: 'Mercato', status: 'Active' },
  ],
  branches: [{ id: 'BR-001', code: 'ADD-01', name: 'Mercato Branch', location: 'Addis Ababa', manager: 'Dawit G.', status: 'Online' }],
  permissions: [
    { id: 'PERM-01', name: 'trade.create', module: 'Trading Desk', role: 'Teller', access: 'Create' },
    { id: 'PERM-02', name: 'trade.approve', module: 'Trading Desk', role: 'Supervisor', access: 'Approve' },
  ],
}

export const useModulesStore = defineStore('modules', () => {
  const records = ref(JSON.parse(JSON.stringify(initialData)))
  function list(moduleKey) { return records.value[moduleKey] || [] }
  function get(moduleKey, id) { return list(moduleKey).find((item) => String(item.id) === String(id)) }
  function create(moduleKey, payload) {
    const rows = records.value[moduleKey] || (records.value[moduleKey] = [])
    const id = payload.id || `${moduleKey.toUpperCase().slice(0, 3)}-${String(Date.now()).slice(-6)}`
    rows.unshift({ ...payload, id })
    return id
  }
  function update(moduleKey, id, payload) {
    const rows = list(moduleKey)
    const index = rows.findIndex((item) => String(item.id) === String(id))
    if (index < 0) return false
    rows[index] = { ...rows[index], ...payload, id: rows[index].id }
    return true
  }
  function remove(moduleKey, id) { records.value[moduleKey] = list(moduleKey).filter((item) => String(item.id) !== String(id)) }
  return { records, list, get, create, update, remove }
})
