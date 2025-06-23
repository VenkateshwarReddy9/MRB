// server/middleware/session.js
const sessions = new Map(); // In production, use Redis or database

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

const sessionMiddleware = (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    
    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        
        // Check if session is expired
        if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
            sessions.delete(sessionId);
            return res.status(401).json({ error: 'Session expired' });
        }
        
        // Update last activity
        session.lastActivity = Date.now();
        sessions.set(sessionId, session);
        
        req.session = session;
    }
    
    next();
};

const createSession = (userId) => {
    const sessionId = require('crypto').randomUUID();
    const session = {
        userId,
        createdAt: Date.now(),
        lastActivity: Date.now()
    };
    
    sessions.set(sessionId, session);
    return sessionId;
};

const destroySession = (sessionId) => {
    sessions.delete(sessionId);
};

module.exports = {
    sessionMiddleware,
    createSession,
    destroySession
};
