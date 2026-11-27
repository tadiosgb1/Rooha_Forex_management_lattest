import { apiRequest } from './apiClient'

/**
 * Accounting Reports service
 *
 * Covers:
 *   GET /cash-management/ledger               – general / daily ledger entries
 *   GET /cash-management/vaults/:id/ledger    – single-vault ledger
 *   GET /cash-management/vaults               – branch vaults with per-currency balances
 *   GET /cash-management/transfers            – cash-flow (inflows / outflows)
 *   GET /cash-management/reconciliations      – daily reconciliations
 *   GET /bank-accounts                        – cash-at-bank accounts list
 *   GET /bank-accounts/summary                – aggregate bank balances
 *   GET /bank-accounts/:id/transactions       – bank ledger entries
 *   GET /trade-transactions                   – BUY / SELL transaction report
 *   GET /forex-daily-transaction-totals/by-date-range   – daily aggregates
 *   GET /forex-annual-transaction-totals/by-branch/:id  – annual aggregates
 */

function qs(params = {}) {
  // drop undefined / null / empty-string values so URLs stay clean
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )
  const s = new URLSearchParams(clean).toString()
  return s ? `?${s}` : ''
}

export const accountingService = {
  // ── Cash-Management Ledger ────────────────────────────────────────────────
  /**
   * Query immutable cash-vault ledger entries.
   * @param {object} params  vaultId, currencyId, referenceType, fromDate, toDate
   * @returns max 500 rows
   */
  getLedger(params = {}) {
    return apiRequest(`cash-management/ledger${qs(params)}`)
  },

  /**
   * Paginated ledger for a single vault.
   * @param {string} vaultId
   * @param {object} params  page, page_size, currencyId, referenceType, fromDate, toDate
   */
  getVaultLedger(vaultId, params = {}) {
    return apiRequest(`cash-management/vaults/${encodeURIComponent(vaultId)}/ledger${qs(params)}`)
  },

  // ── Vaults / Balances ─────────────────────────────────────────────────────
  /**
   * List branch vaults with per-currency balances.
   * @param {object} params  branchId, vaultType, ownerUserId
   */
  getVaults(params = {}) {
    return apiRequest(`cash-management/vaults${qs(params)}`)
  },

  // ── Transfers (Cash Flow) ─────────────────────────────────────────────────
  /**
   * List incoming / outgoing cash transfers.
   * @param {object} params  status, currencyId, direction (INCOMING|OUTGOING),
   *                         transferType, vaultId, fromDate, toDate
   */
  getTransfers(params = {}) {
    return apiRequest(`cash-management/transfers${qs(params)}`)
  },

  // ── Reconciliations ───────────────────────────────────────────────────────
  /**
   * List daily cash reconciliations.
   * @param {object} params  vaultId, currencyId, businessDate, status (MATCHED|VARIANCE_FLAGGED)
   */
  getReconciliations(params = {}) {
    return apiRequest(`cash-management/reconciliations${qs(params)}`)
  },

  // ── Bank Accounts ─────────────────────────────────────────────────────────
  /**
   * List registered bureau bank accounts.
   * @param {object} params  bank_id, currency_id, is_active, page, limit
   */
  getBankAccounts(params = {}) {
    return apiRequest(`bank-accounts${qs(params)}`)
  },

  /**
   * Aggregate summary of all bank account balances.
   */
  getBankAccountSummary() {
    return apiRequest('bank-accounts/summary')
  },

  /**
   * Paginated bank-account ledger (deposits / withdrawals).
   * @param {string} accountId
   * @param {object} params  page, limit
   */
  getBankAccountLedger(accountId, params = {}) {
    return apiRequest(`bank-accounts/${encodeURIComponent(accountId)}/transactions${qs(params)}`)
  },

  // ── Trade Transactions ────────────────────────────────────────────────────
  /**
   * List BUY / SELL trade transactions.
   * @param {object} params  transaction_type, status, payment_method, period,
   *                         start_date, end_date, customer, bank_id, page, limit
   */
  getTradeTransactions(params = {}) {
    return apiRequest(`trade-transactions${qs(params)}`)
  },

  // ── Aggregated Totals ─────────────────────────────────────────────────────
  /**
   * Daily transaction totals for a date range.
   * @param {object} params  startDate, endDate
   */
  getDailyTotalsByRange(params = {}) {
    return apiRequest(`forex-daily-transaction-totals/by-date-range${qs(params)}`)
  },

  /**
   * Annual transaction totals for a branch.
   * @param {string} branchId
   */
  getAnnualTotalsByBranch(branchId) {
    return apiRequest(`forex-annual-transaction-totals/by-branch/${encodeURIComponent(branchId)}`)
  },
}
