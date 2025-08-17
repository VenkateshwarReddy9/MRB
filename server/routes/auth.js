const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

// Register a new user using Firebase Authentication
router.post('/register', async (req, res) => {
    const { email, password, role = 'staff' } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    try {
        const userRecord = await admin.auth().createUser({ email, password });
        await db.query(
            'INSERT INTO users (uid, email, role, status) VALUES ($1, $2, $3, $4) ON CONFLICT (uid) DO NOTHING',
            [userRecord.uid, email, role, 'active']
        );
        res.status(201).json({ message: 'User registered successfully', uid: userRecord.uid });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login expects a Firebase ID token from the client and verifies it
router.post('/login', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        res.json({ uid: decoded.uid, email: decoded.email });
    } catch (err) {
        console.error('Login error:', err);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Return information about the currently authenticated user
router.get('/me', authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
