const express = require('express');
const router = express.Router();
const db = require('../database');
const { validateId } = require('../middleware/validation');

// Get notifications for the authenticated user
router.get('/', async (req, res) => {
    try {
        const { is_read, limit = 50, offset = 0 } = req.query;

        let sql = `
            SELECT * FROM notifications
            WHERE user_uid = $1
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        const params = [req.user.uid];
        let paramCount = 1;

        if (is_read !== undefined) {
            sql += ` AND is_read = $${++paramCount}`;
            params.push(is_read === 'true');
        }

        sql += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(parseInt(limit), parseInt(offset));

        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
});

// Mark a single notification as read
router.put('/:id/read', validateId, async (req, res) => {
    const notificationId = req.params.id;

    try {
        const sql = `
            UPDATE notifications
            SET is_read = true
            WHERE id = $1 AND user_uid = $2
            RETURNING *
        `;
        const { rows } = await db.query(sql, [notificationId, req.user.uid]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found.' });
        }

        res.json({ data: rows[0] });
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
});

// Mark all notifications as read
router.put('/mark-all-read', async (req, res) => {
    try {
        const sql = `
            UPDATE notifications
            SET is_read = true
            WHERE user_uid = $1 AND is_read = false
            RETURNING COUNT(*) as updated_count
        `;
        const { rows } = await db.query(sql, [req.user.uid]);

        res.json({ message: 'All notifications marked as read', count: rows.length });
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
        res.status(500).json({ error: 'Failed to mark all notifications as read.' });
    }
});

// Delete a notification
router.delete('/:id', validateId, async (req, res) => {
    const notificationId = req.params.id;

    try {
        const sql = `
            DELETE FROM notifications
            WHERE id = $1 AND user_uid = $2
            RETURNING *
        `;
        const { rows } = await db.query(sql, [notificationId, req.user.uid]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found.' });
        }

        res.json({ message: 'Notification deleted successfully' });
    } catch (err) {
        console.error('Error deleting notification:', err);
        res.status(500).json({ error: 'Failed to delete notification.' });
    }
});

module.exports = router;
