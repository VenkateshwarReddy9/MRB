// server/middleware/auth.js
const admin = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const db = require('../database');

// Enhanced authentication middleware
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        
        // Verify Firebase token
        const decodedToken = await admin.auth().verifyIdToken(token);
        
        // Add user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            email_verified: decodedToken.email_verified
        };

        // Log authentication event (optional - don't log every request in production)
        if (process.env.NODE_ENV === 'development') {
            await logActivity(req.user, 'AUTH_SUCCESS', `User authenticated: ${req.user.email}`, req);
        }
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        
        // Log failed authentication
        const ip = req.ip || req.connection.remoteAddress;
        console.log(`Failed authentication attempt from IP: ${ip}`);
        
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Rate limiting for authentication endpoints
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs for auth endpoints
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 15 * 60 // 15 minutes in seconds
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

// Strict rate limiting for login attempts
const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: {
        error: 'Too many login attempts, please try again later.',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Enhanced admin check middleware
const adminOnly = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await db.query('SELECT role, status FROM users WHERE uid = $1', [req.user.uid]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found in system' });
        }

        const user = result.rows[0];
        
        if (user.status !== 'active') {
            await logActivity(req.user, 'ACCESS_DENIED', 'Inactive account attempted admin access', req);
            return res.status(403).json({ error: 'Account is inactive' });
        }

        if (!user.role.includes('admin')) {
            await logActivity(req.user, 'ACCESS_DENIED', 'Non-admin attempted admin access', req);
            return res.status(403).json({ error: 'Admin access required' });
        }

        req.userRole = user.role;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

// Secondary admin check (for features that secondary admins can access)
const adminOrSecondaryAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const result = await db.query('SELECT role, status FROM users WHERE uid = $1', [req.user.uid]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found in system' });
        }

        const user = result.rows[0];
        
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive' });
        }

        if (!user.role.includes('admin') && user.role !== 'secondary_admin') {
            await logActivity(req.user, 'ACCESS_DENIED', 'Insufficient privileges for admin access', req);
            return res.status(403).json({ error: 'Admin or Secondary Admin access required' });
        }

        req.userRole = user.role;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

// Enhanced activity logging with IP and User Agent
const logActivity = async (user, actionType, details, req = null) => {
    try {
        const ip = req ? (req.ip || req.connection.remoteAddress) : null;
        const userAgent = req ? req.get('User-Agent') : null;
        
        await db.query(
            'INSERT INTO activity_logs (user_uid, user_email, action_type, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
            [user.uid, user.email, actionType, details, ip, userAgent]
        );
    } catch (error) {
        console.error('Activity logging error:', error);
        // Don't throw error - logging failure shouldn't break the main operation
    }
};

module.exports = {
    authMiddleware,
    authRateLimit,
    loginRateLimit,
    adminOnly,
    adminOrSecondaryAdmin,
    logActivity
};
