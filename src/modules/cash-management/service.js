import { apiRequest } from '../../services/apiClient'
export const cashManagementService={ post(path,payload={}){return apiRequest(path,{method:'POST',body:payload})} }
