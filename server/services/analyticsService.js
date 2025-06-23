// server/services/analyticsService.js
const db = require('../database');

class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    // Real-time sales metrics
    async getRealTimeSalesMetrics() {
        const cacheKey = 'realtime_sales';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const today = new Date().toISOString().split('T')[0];
            
            const sql = `
                SELECT 
                    COUNT(CASE WHEN type = 'sale' THEN 1 END) as total_sales_count,
                    COUNT(CASE WHEN type = 'expense' THEN 1 END) as total_expenses_count,
                    COALESCE(SUM(CASE WHEN type = 'sale' THEN amount END), 0) as total_sales_amount,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) as total_expenses_amount,
                    COALESCE(AVG(CASE WHEN type = 'sale' THEN amount END), 0) as avg_sale_amount,
                    COALESCE(MAX(CASE WHEN type = 'sale' THEN amount END), 0) as max_sale_amount,
                    COUNT(CASE WHEN type = 'sale' AND transaction_date >= NOW() - INTERVAL '1 hour' THEN 1 END) as sales_last_hour,
                    COUNT(CASE WHEN type = 'sale' AND transaction_date >= NOW() - INTERVAL '15 minutes' THEN 1 END) as sales_last_15min
                FROM transactions 
                WHERE DATE(transaction_date) = $1 AND status = 'approved'
            `;
            
            const result = await db.query(sql, [today]);
            const metrics = result.rows[0];
            
            // Calculate additional metrics
            const profit = parseFloat(metrics.total_sales_amount) - parseFloat(metrics.total_expenses_amount);
            const salesVelocity = parseFloat(metrics.sales_last_hour) / 4; // Sales per 15min average
            
            const data = {
                ...metrics,
                profit,
                salesVelocity,
                timestamp: new Date().toISOString()
            };
            
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('Error getting real-time sales metrics:', error);
            throw error;
        }
    }

    // Sales forecasting based on historical data
    async getSalesForecast() {
        try {
            const sql = `
                SELECT 
                    DATE(transaction_date) as date,
                    EXTRACT(hour FROM transaction_date) as hour,
                    COUNT(*) as transaction_count,
                    SUM(amount) as total_amount
                FROM transactions 
                WHERE type = 'sale' 
                    AND status = 'approved'
                    AND transaction_date >= NOW() - INTERVAL '30 days'
                GROUP BY DATE(transaction_date), EXTRACT(hour FROM transaction_date)
                ORDER BY date DESC, hour
            `;
            
            const result = await db.query(sql);
            const historicalData = result.rows;
            
            // Simple forecasting algorithm
            const currentHour = new Date().getHours();
            const todayData = historicalData.filter(row => 
                new Date(row.date).toDateString() === new Date().toDateString()
            );
            
            const historicalHourlyAvg = this.calculateHourlyAverages(historicalData);
            const forecast = this.generateHourlyForecast(historicalHourlyAvg, currentHour, todayData);
            
            return {
                forecast,
                historicalData: historicalHourlyAvg,
                confidence: this.calculateForecastConfidence(historicalData)
            };
        } catch (error) {
            console.error('Error generating sales forecast:', error);
            throw error;
        }
    }

    // Peak hours analysis
    async getPeakHoursAnalysis() {
        try {
            const sql = `
                SELECT 
                    EXTRACT(hour FROM transaction_date) as hour,
                    COUNT(*) as transaction_count,
                    AVG(amount) as avg_amount,
                    SUM(amount) as total_amount
                FROM transactions 
                WHERE type = 'sale' 
                    AND status = 'approved'
                    AND transaction_date >= NOW() - INTERVAL '30 days'
                GROUP BY EXTRACT(hour FROM transaction_date)
                ORDER BY transaction_count DESC
            `;
            
            const result = await db.query(sql);
            const hourlyData = result.rows;
            
            // Identify peak hours (top 25% by transaction count)
            const sortedByCount = [...hourlyData].sort((a, b) => b.transaction_count - a.transaction_count);
            const peakThreshold = Math.ceil(sortedByCount.length * 0.25);
            const peakHours = sortedByCount.slice(0, peakThreshold);
            
            return {
                peakHours: peakHours.map(h => ({
                    hour: parseInt(h.hour),
                    transactionCount: parseInt(h.transaction_count),
                    avgAmount: parseFloat(h.avg_amount),
                    totalAmount: parseFloat(h.total_amount)
                })),
                allHours: hourlyData.map(h => ({
                    hour: parseInt(h.hour),
                    transactionCount: parseInt(h.transaction_count),
                    avgAmount: parseFloat(h.avg_amount),
                    totalAmount: parseFloat(h.total_amount)
                }))
            };
        } catch (error) {
            console.error('Error analyzing peak hours:', error);
            throw error;
        }
    }

    // Helper methods for forecasting
    calculateHourlyAverages(data) {
        const hourlyStats = {};
        
        for (let hour = 0; hour < 24; hour++) {
            const hourData = data.filter(row => parseInt(row.hour) === hour);
            if (hourData.length > 0) {
                hourlyStats[hour] = {
                    avgTransactions: hourData.reduce((sum, row) => sum + parseInt(row.transaction_count), 0) / hourData.length,
                    avgAmount: hourData.reduce((sum, row) => sum + parseFloat(row.total_amount), 0) / hourData.length,
                    dataPoints: hourData.length
                };
            } else {
                hourlyStats[hour] = { avgTransactions: 0, avgAmount: 0, dataPoints: 0 };
            }
        }
        
        return hourlyStats;
    }

    generateHourlyForecast(historicalAvg, currentHour, todayData) {
        const forecast = [];
        const remainingHours = 24 - currentHour;
        
        for (let i = 0; i < remainingHours; i++) {
            const hour = currentHour + i;
            const historical = historicalAvg[hour] || { avgTransactions: 0, avgAmount: 0 };
            
            // Apply some randomness and trend adjustment
            const trendMultiplier = 1 + (Math.random() - 0.5) * 0.2; // ±10% variation
            
            forecast.push({
                hour,
                predictedTransactions: Math.round(historical.avgTransactions * trendMultiplier),
                predictedAmount: historical.avgAmount * trendMultiplier,
                confidence: historical.dataPoints > 5 ? 'high' : historical.dataPoints > 2 ? 'medium' : 'low'
            });
        }
        
        return forecast;
    }

    calculateForecastConfidence(data) {
        const dataPoints = data.length;
        const dateRange = data.length > 0 ? 
            (new Date(Math.max(...data.map(d => new Date(d.date)))) - new Date(Math.min(...data.map(d => new Date(d.date))))) / (1000 * 60 * 60 * 24) : 0;
        
        if (dataPoints > 100 && dateRange > 14) return 'high';
        if (dataPoints > 50 && dateRange > 7) return 'medium';
        return 'low';
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }
}

module.exports = new AnalyticsService();
