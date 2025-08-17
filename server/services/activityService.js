const db = require('../database');

let ioInstance;

function init(io) {
    ioInstance = io;
}

const logActivity = async (user, actionType, details = '', req = null) => {
    if (!user || !user.uid || !user.email) {
        console.error('logActivity: Invalid user object provided');
        return;
    }

    try {
        const sql = `
            INSERT INTO activity_logs (user_uid, user_email, action_type, details, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;

        const ipAddress = req ? (req.ip || req.connection?.remoteAddress || req.headers?.['x-forwarded-for']) : null;
        const userAgent = req ? req.get('User-Agent') : null;

        await db.query(sql, [
            user.uid,
            user.email,
            actionType,
            details || '',
            ipAddress,
            userAgent
        ]);

        console.log(`✅ Activity logged: ${actionType} by ${user.email}`);
    } catch (err) {
        console.error('❌ Failed to log activity:', {
            error: err.message,
            user: user.email,
            action: actionType
        });
    }
};

const createNotification = async (userId, title, message, type = 'info', actionUrl = null) => {
    try {
        const sql = `
            INSERT INTO notifications (user_uid, title, message, type, action_url)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        const { rows } = await db.query(sql, [userId, title, message, type, actionUrl]);

        if (ioInstance) {
            ioInstance.to(`user-${userId}`).emit('notification', rows[0]);
        }

        return rows[0];
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

module.exports = {
    init,
    logActivity,
    createNotification
};
