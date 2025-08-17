const express = require('express');
const router = express.Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// Protect all routes below
router.use(authMiddleware);

// List transactions for the authenticated user
router.get('/', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM transactions WHERE user_uid = $1 ORDER BY transaction_date DESC',
            [req.user.uid]
        );
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Create a new transaction
router.post('/', async (req, res) => {
    const { description, amount, type, category, notes } = req.body;
    if (!description || !amount || !type) {
        return res.status(400).json({ error: 'description, amount and type are required' });
    }
    try {
        const { rows } = await db.query(
            `INSERT INTO transactions (user_uid, description, amount, type, category, notes)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.uid, description, amount, type, category || null, notes || null]
        );
        res.status(201).json({ message: 'Transaction created', data: rows[0] });
    } catch (err) {
        console.error('Error creating transaction:', err);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

// Retrieve a single transaction
router.get('/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT * FROM transactions WHERE id = $1 AND user_uid = $2',
            [req.params.id, req.user.uid]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json({ data: rows[0] });
    } catch (err) {
        console.error('Error fetching transaction:', err);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// Update a transaction
router.put('/:id', async (req, res) => {
    const { description, amount, type, category, notes } = req.body;
    try {
        const { rows } = await db.query(
            `UPDATE transactions
             SET description = $1, amount = $2, type = $3, category = $4, notes = $5, updated_at = NOW()
             WHERE id = $6 AND user_uid = $7 RETURNING *`,
            [description, amount, type, category || null, notes || null, req.params.id, req.user.uid]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json({ message: 'Transaction updated', data: rows[0] });
    } catch (err) {
        console.error('Error updating transaction:', err);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Delete a transaction
router.delete('/:id', async (req, res) => {
    try {
        const { rows } = await db.query(
            'DELETE FROM transactions WHERE id = $1 AND user_uid = $2 RETURNING *',
            [req.params.id, req.user.uid]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json({ message: 'Transaction deleted', data: rows[0] });
    } catch (err) {
        console.error('Error deleting transaction:', err);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

module.exports = router;
