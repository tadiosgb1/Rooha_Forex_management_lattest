import { apiRequest } from '../../services/apiClient'
export const cashManagementService = { list(path){return apiRequest(path)}, post(path,payload={}){return apiRequest(path,{method:'POST',body:payload})}, patch(path,payload={}){return apiRequest(path,{method:'PATCH',body:payload})} }
