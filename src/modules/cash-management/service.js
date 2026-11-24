import { apiRequest } from '../../services/apiClient'

export const cashManagementService = {
  list(path)              { return apiRequest(path) },
  post(path, payload={})  { return apiRequest(path, { method: 'POST',  body: payload }) },
  patch(path, payload={}) { return apiRequest(path, { method: 'PATCH', body: payload }) },
}

/**
 * Vault Dashboard service
 *
 * getBranchVault()         → GET /cash-management/vaults?vaultType=BRANCH_VAULT
 *                            Returns the branch-level vault for the logged-in user's branch.
 *
 * getMyVault()             → GET /cash-management/vaults/my
 *                            Returns the vault assigned to the logged-in user (teller till
 *                            or branch vault custodian). No user ID needed from the frontend.
 *
 * getVaultBalances(id)     → GET /cash-management/vaults/:id/balances
 *                            Returns current currency balances for a vault.
 *
 * getVaultLedger(id,opts)  → GET /cash-management/vaults/:id/ledger
 *                            Returns ledger entries including balance_before and balance_after.
 */
export const vaultDashboardService = {
  getBranchVault() {
    return apiRequest('cash-management/vaults?vaultType=BRANCH_VAULT')
  },

  getMyVault() {
    return apiRequest('cash-management/vaults/my')
  },

  getTellerTills() {
    return apiRequest('cash-management/vaults?vaultType=TELLER_TILL')
  },

  getVaultBalances(vaultId) {
    return apiRequest(`cash-management/vaults/${encodeURIComponent(vaultId)}/balances`)
  },

  getVaultLedger(vaultId, { page = 1, pageSize = 20, currencyCode = '' } = {}) {
    const params = new URLSearchParams({ page, page_size: pageSize, vaultId })
    if (currencyCode) params.set('currency_code', currencyCode)
    return apiRequest(`cash-management/ledger?${params}`)
  },
}

