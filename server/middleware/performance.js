// server/middleware/performance.js
const performanceMiddleware = (req, res, next) => {
    const start = Date.now();
    
    // Override res.json to capture response time
    const originalJson = res.json;
    res.json = function(body) {
        const duration = Date.now() - start;
        
        // Add performance headers
        res.set('X-Response-Time', `${duration}ms`);
        res.set('X-Timestamp', new Date().toISOString());
        
        // Log slow requests
        if (duration > 1000) {
            console.warn(`🐌 Slow request: ${req.method} ${req.path} took ${duration}ms`);
        }
        
        // Log in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`⚡ ${req.method} ${req.path} - ${duration}ms`);
        }
        
        return originalJson.call(this, body);
    };
    
    next();
};

// Memory usage monitoring
const memoryMonitor = () => {
    const used = process.memoryUsage();
    const usage = {};
    
    for (let key in used) {
        usage[key] = Math.round(used[key] / 1024 / 1024 * 100) / 100;
    }
    
    return usage;
};

// Database connection monitoring
const dbConnectionMonitor = (pool) => {
    return {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
    };
};

module.exports = {
    performanceMiddleware,
    memoryMonitor,
    dbConnectionMonitor
};
