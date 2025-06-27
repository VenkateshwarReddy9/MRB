// client/src/services/api.js - Complete Enhanced API Service

class ApiService {
    constructor() {
        this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        this.timeout = 30000;
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Cache key generator
    getCacheKey(endpoint, options = {}) {
        const method = options.method || 'GET';
        const body = options.body || '';
        return `${method}:${endpoint}:${body}`;
    }

    // Check if cache is valid
    isCacheValid(cacheEntry) {
        return Date.now() - cacheEntry.timestamp < this.cacheTimeout;
    }

    // Get from cache
    getFromCache(key) {
        const cacheEntry = this.cache.get(key);
        if (cacheEntry && this.isCacheValid(cacheEntry)) {
            console.log('📦 Cache hit:', key);
            return cacheEntry.data;
        }
        return null;
    }

    // Set cache
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Clean old cache entries
        if (this.cache.size > 100) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    async request(endpoint, options = {}) {
        // Check cache for GET requests
        if (!options.method || options.method === 'GET') {
            const cacheKey = this.getCacheKey(endpoint, options);
            const cachedData = this.getFromCache(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        const url = `${this.baseURL}${endpoint}`;
        const config = {
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Cache GET requests
            if (!options.method || options.method === 'GET') {
                const cacheKey = this.getCacheKey(endpoint, options);
                this.setCache(cacheKey, data);
            }

            return data;
        } catch (error) {
            console.error('API Request failed:', error);
            throw error;
        }
    }

    async authenticatedRequest(endpoint, options = {}) {
        const { auth } = await import('../firebase');
        
        if (!auth.currentUser) {
            throw new Error('User not authenticated');
        }

        const token = await auth.currentUser.getIdToken();
        
        return this.request(endpoint, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                ...options.headers,
            },
        });
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
        console.log('🗑️ Cache cleared');
    }

    // Clear specific cache entries
    clearCachePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    // TRANSACTION API METHODS
    async getTransactions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = params.all ? '/api/transactions/all' : '/api/transactions';
        return this.authenticatedRequest(`${endpoint}${queryString ? `?${queryString}` : ''}`);
    }

    async getTransactionsPaginated(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/transactions${queryString ? `?${queryString}` : ''}`);
    }

    async createTransaction(data) {
        const result = await this.authenticatedRequest('/api/transactions', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        // Clear transaction-related cache
        this.clearCachePattern('/api/transactions');
        this.clearCachePattern('/api/dashboard');
        
        return result;
    }

    async updateTransaction(id, data) {
        const result = await this.authenticatedRequest(`/api/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        // Clear transaction-related cache
        this.clearCachePattern('/api/transactions');
        this.clearCachePattern('/api/dashboard');
        
        return result;
    }

    async deleteTransaction(id) {
        const result = await this.authenticatedRequest(`/api/transactions/${id}`, {
            method: 'DELETE',
        });
        
        // Clear transaction-related cache
        this.clearCachePattern('/api/transactions');
        this.clearCachePattern('/api/dashboard');
        
        return result;
    }

    async requestTransactionDeletion(id, reason) {
        const result = await this.authenticatedRequest(`/api/transactions/${id}/request-delete`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        });
        
        this.clearCachePattern('/api/approval');
        return result;
    }

    // DASHBOARD API METHODS
    async getDashboardSummary(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/dashboard/summary${queryString ? `?${queryString}` : ''}`);
    }

    async getDashboardStats(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/dashboard/stats${queryString ? `?${queryString}` : ''}`);
    }

    async getDashboardChartData(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/dashboard/chart-data${queryString ? `?${queryString}` : ''}`);
    }

    // USER API METHODS
    async getUserProfile() {
        return this.authenticatedRequest('/api/me');
    }

    async getUsers() {
        return this.authenticatedRequest('/api/users');
    }

    async createUser(data) {
        const result = await this.authenticatedRequest('/api/users', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/users');
        return result;
    }

    async updateUser(uid, data) {
        const result = await this.authenticatedRequest(`/api/users/${uid}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/users');
        return result;
    }

    async deleteUser(uid) {
        const result = await this.authenticatedRequest(`/api/users/${uid}`, {
            method: 'DELETE',
        });
        
        this.clearCachePattern('/api/users');
        return result;
    }

    // EMPLOYEE API METHODS
    async getEmployees() {
        return this.authenticatedRequest('/api/employees');
    }

    async getEmployee(uid) {
        return this.authenticatedRequest(`/api/employees/${uid}`);
    }

    async createEmployee(data) {
        const result = await this.authenticatedRequest('/api/employees', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/employees');
        return result;
    }

    async updateEmployee(uid, data) {
        const result = await this.authenticatedRequest(`/api/employees/${uid}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/employees');
        return result;
    }

    async deleteEmployee(uid) {
        const result = await this.authenticatedRequest(`/api/employees/${uid}`, {
            method: 'DELETE',
        });
        
        this.clearCachePattern('/api/employees');
        return result;
    }

    // SHIFT TEMPLATES API METHODS
    async getShiftTemplates() {
        return this.authenticatedRequest('/api/shift-templates');
    }

    async createShiftTemplate(data) {
        const result = await this.authenticatedRequest('/api/shift-templates', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/shift-templates');
        return result;
    }

    async updateShiftTemplate(id, data) {
        const result = await this.authenticatedRequest(`/api/shift-templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/shift-templates');
        return result;
    }

    async deleteShiftTemplate(id) {
        const result = await this.authenticatedRequest(`/api/shift-templates/${id}`, {
            method: 'DELETE',
        });
        
        this.clearCachePattern('/api/shift-templates');
        return result;
    }

    // ROTA API METHODS
    async getRotaData(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/rota${queryString ? `?${queryString}` : ''}`);
    }

    async createRotaEntry(data) {
        const result = await this.authenticatedRequest('/api/rota', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/rota');
        return result;
    }

    async updateRotaEntry(id, data) {
        const result = await this.authenticatedRequest(`/api/rota/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/rota');
        return result;
    }

    async deleteRotaEntry(id) {
        const result = await this.authenticatedRequest(`/api/rota/${id}`, {
            method: 'DELETE',
        });
        
        this.clearCachePattern('/api/rota');
        return result;
    }

    async publishRota(data) {
        const result = await this.authenticatedRequest('/api/rota/publish', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/rota');
        return result;
    }

    async copyPreviousWeek(data) {
        const result = await this.authenticatedRequest('/api/rota/copy-previous-week', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/rota');
        return result;
    }

    async smartAssignShifts(data) {
        const result = await this.authenticatedRequest('/api/rota/smart-assign', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/rota');
        return result;
    }

    // AVAILABILITY API METHODS
    async getAvailabilityRequests() {
        return this.authenticatedRequest('/api/availability-requests');
    }

    async createAvailabilityRequest(data) {
        const result = await this.authenticatedRequest('/api/availability-requests', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/availability');
        return result;
    }

    async updateAvailabilityRequest(id, data) {
        const result = await this.authenticatedRequest(`/api/availability-requests/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/availability');
        return result;
    }

    async deleteAvailabilityRequest(id) {
        const result = await this.authenticatedRequest(`/api/availability-requests/${id}`, {
            method: 'DELETE',
        });
        
        this.clearCachePattern('/api/availability');
        return result;
    }

    // TIME CLOCK API METHODS
    async getTimeClockStatus() {
        return this.authenticatedRequest('/api/time-clock/status');
    }

    async clockIn(data) {
        const result = await this.authenticatedRequest('/api/time-clock/clock-in', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/time-clock');
        this.clearCachePattern('/api/dashboard');
        return result;
    }

    async clockOut(data) {
        const result = await this.authenticatedRequest('/api/time-clock/clock-out', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/time-clock');
        this.clearCachePattern('/api/dashboard');
        return result;
    }

    async startBreak() {
        const result = await this.authenticatedRequest('/api/time-clock/break-start', {
            method: 'POST',
        });
        
        this.clearCachePattern('/api/time-clock');
        return result;
    }

    async endBreak() {
        const result = await this.authenticatedRequest('/api/time-clock/break-end', {
            method: 'POST',
        });
        
        this.clearCachePattern('/api/time-clock');
        return result;
    }

    // TIME ENTRIES API METHODS
    async getTimeEntries(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/time-entries${queryString ? `?${queryString}` : ''}`);
    }

    // APPROVAL API METHODS
    async getApprovalRequests() {
        return this.authenticatedRequest('/api/approval-requests');
    }

    async approveRequest(id, data = {}) {
        const result = await this.authenticatedRequest(`/api/transactions/${id}/approve-delete`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/approval');
        this.clearCachePattern('/api/transactions');
        return result;
    }

    async rejectRequest(id, data = {}) {
        const result = await this.authenticatedRequest(`/api/transactions/${id}/reject-delete`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/approval');
        return result;
    }

    // REPORTS API METHODS
    async getTimesheetReport(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/reports/timesheet${queryString ? `?${queryString}` : ''}`);
    }

    async getTimesheetSummary(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/reports/timesheet-summary${queryString ? `?${queryString}` : ''}`);
    }

    async getLaborVsSalesReport(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/reports/labor-vs-sales${queryString ? `?${queryString}` : ''}`);
    }

    async getLaborEfficiencyReport(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/reports/labor-efficiency${queryString ? `?${queryString}` : ''}`);
    }

    // ANALYTICS API METHODS
    async getRealTimeAnalytics() {
        return this.authenticatedRequest('/api/analytics/real-time');
    }

    async getSalesForecast(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/analytics/forecast${queryString ? `?${queryString}` : ''}`);
    }

    async getPeakHoursAnalysis(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/analytics/peak-hours${queryString ? `?${queryString}` : ''}`);
    }

    async getSalesMetrics(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/analytics/sales-metrics${queryString ? `?${queryString}` : ''}`);
    }

    async getCustomerMetrics(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/analytics/customer-metrics${queryString ? `?${queryString}` : ''}`);
    }

    // NOTIFICATIONS API METHODS
    async getNotifications() {
        return this.authenticatedRequest('/api/notifications');
    }

    async markNotificationRead(id) {
        const result = await this.authenticatedRequest(`/api/notifications/${id}/read`, {
            method: 'POST',
        });
        
        this.clearCachePattern('/api/notifications');
        return result;
    }

    async markAllNotificationsRead() {
        const result = await this.authenticatedRequest('/api/notifications/mark-all-read', {
            method: 'POST',
        });
        
        this.clearCachePattern('/api/notifications');
        return result;
    }

    // ACTIVITY LOGS API METHODS
    async getActivityLogs(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.authenticatedRequest(`/api/activity-logs${queryString ? `?${queryString}` : ''}`);
    }

    // SETTINGS API METHODS
    async getSettings() {
        return this.authenticatedRequest('/api/settings');
    }

    async updateSettings(data) {
        const result = await this.authenticatedRequest('/api/settings', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        
        this.clearCachePattern('/api/settings');
        return result;
    }

    // HEALTH CHECK (no auth required)
    async healthCheck() {
        return this.request('/health');
    }

    // UTILITY METHODS
    async exportData(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const { auth } = await import('../firebase');
        const token = await auth.currentUser.getIdToken();
        
        const url = `${this.baseURL}${endpoint}${queryString ? `?${queryString}&token=${token}` : `?token=${token}`}`;
        window.open(url, '_blank');
    }

    // Upload file method
    async uploadFile(file, endpoint = '/api/upload') {
        const { auth } = await import('../firebase');
        const token = await auth.currentUser.getIdToken();
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload failed: ${response.status}`);
        }
        
        return response.json();
    }

    // Batch operations
    async batchRequest(requests) {
        const results = await Promise.allSettled(
            requests.map(({ endpoint, options }) => this.authenticatedRequest(endpoint, options))
        );
        
        return results.map((result, index) => ({
            index,
            status: result.status,
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null,
        }));
    }
}

// Create singleton instance
const apiService = new ApiService();

// Export both named and default exports
export { apiService };
export default apiService;
