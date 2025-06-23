const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const admin = require('firebase-admin');
const analyticsService = require('./services/analyticsService');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cron = require('node-cron');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const {
  validateUser,
  validateEmployee,
  validateUid      // ← add this line
} = require('./middleware/validation');

const db = require('./database.js');

const firebaseCert = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
  credential: admin.credential.cert(firebaseCert)
});



db.createTables();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for WebSocket support
const server = createServer(app);

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|csv|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('📡 Client connected to real-time analytics');
    
    socket.on('join-analytics', (data) => {
        socket.join('analytics-room');
        console.log('📊 Client joined analytics room');
    });
    
    socket.on('join-notifications', (data) => {
        socket.join(`user-${data.userId}`);
        console.log(`🔔 User ${data.userId} joined notifications`);
    });
    
    socket.on('disconnect', () => {
        console.log('📡 Client disconnected from analytics');
    });
});

// Real-time analytics broadcasting function
const broadcastAnalytics = async () => {
    try {
        const metrics = await analyticsService.getRealTimeSalesMetrics();
        io.to('analytics-room').emit('analytics-update', metrics);
        console.log('📈 Broadcasting analytics update to clients');
    } catch (error) {
        console.error('Error broadcasting analytics:', error);
    }
};

// Notification broadcasting function
const broadcastNotification = (userId, notification) => {
    io.to(`user-${userId}`).emit('notification', notification);
};

// Schedule real-time updates every 30 seconds
cron.schedule('*/30 * * * * *', broadcastAnalytics);

// Daily summary update (runs at midnight)
cron.schedule('0 0 * * *', async () => {
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        
        await db.maintenance.updateDailySummaries(dateStr);
        console.log(`📊 Daily summary updated for ${dateStr}`);
    } catch (error) {
        console.error('Error updating daily summary:', error);
    }
});

// Middleware setup
const performanceMiddleware = (req, res, next) => {
    const startTime = Date.now();
    req.startTime = startTime;
    
    const originalEnd = res.end;
    res.end = function(...args) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        console.log(`${req.method} ${req.path} - ${responseTime}ms`);
        res.set('X-Response-Time', `${responseTime}ms`);
        
        originalEnd.apply(this, args);
    };
    
    next();
};

app.use(performanceMiddleware);
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));

if (process.env.NODE_ENV === 'production') {
    app.use(compression());
}

const corsOptions = {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth', authRateLimit);
app.use('/api/login', loginRateLimit);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static('uploads'));

// Authentication middleware
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) { 
        return res.status(401).send('Unauthorized: No token provided.'); 
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        const upsertSql = `INSERT INTO "users" (uid, email, role, status) VALUES ($1, $2, 'staff', 'active') ON CONFLICT (uid) DO NOTHING;`;
        await db.query(upsertSql, [decodedToken.uid, decodedToken.email]);
        
        const selectSql = `SELECT * FROM "users" WHERE uid = $1`;
        const { rows } = await db.query(selectSql, [decodedToken.uid]);
        
        if (rows.length === 0) {
            return res.status(500).send("Error: Could not retrieve user profile.");
        }
        
        const user = rows[0];
        if (user.status === 'inactive') {
            return res.status(403).send('Forbidden: Your account has been disabled.');
        }
        
        req.user = { ...decodedToken, role: user.role, status: user.status };
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(403).send('Unauthorized: Invalid token or server error.');
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'primary_admin' || req.user.role === 'secondary_admin')) { 
        next(); 
    } else { 
        res.status(403).send('Forbidden: Admins only.'); 
    }
};

const adminOrSecondaryAdmin = (req, res, next) => {
    if (req.user && (req.user.role === 'primary_admin' || req.user.role === 'secondary_admin')) { 
        next(); 
    } else { 
        res.status(403).send('Forbidden: Admin access required.'); 
    }
};

// Apply auth middleware to protected routes
app.use('/api/transactions', authMiddleware);
app.use('/api/employees', authMiddleware);
app.use('/api/users', authMiddleware, adminOnly);
app.use('/api/rota', authMiddleware);
app.use('/api/availability', authMiddleware);
app.use('/api/reports', authMiddleware);
app.use('/api/dashboard', authMiddleware);
app.use('/api/me', authMiddleware);
app.use('/api/my-schedule', authMiddleware);
app.use('/api/time-clock', authMiddleware);
app.use('/api/shift-templates', authMiddleware);
app.use('/api/approval-requests', authMiddleware, adminOrSecondaryAdmin);
app.use('/api/time-entries', authMiddleware, adminOrSecondaryAdmin);
app.use('/api/activity-logs', authMiddleware, adminOnly);
app.use('/api/analytics', authMiddleware);
app.use('/api/notifications', authMiddleware);
app.use('/api/settings', authMiddleware);
app.use('/api/inventory', authMiddleware);
app.use('/api/categories', authMiddleware);
app.use('/api/products', authMiddleware);

// Activity logging function
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
        console.error("❌ Failed to log activity:", {
            error: err.message,
            user: user.email,
            action: actionType
        });
        // Don't throw - just log the error
    }
};


// Notification creation function
const createNotification = async (userId, title, message, type = 'info', actionUrl = null) => {
    try {
        const sql = `
            INSERT INTO notifications (user_uid, title, message, type, action_url) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING *
        `;
        const { rows } = await db.query(sql, [userId, title, message, type, actionUrl]);
        
        // Broadcast real-time notification
        broadcastNotification(userId, rows[0]);
        
        return rows[0];
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

// Validation functions
const validateTransaction = (req, res, next) => {
    const { description, amount, type, category } = req.body;
    const errors = [];

    if (!description || description.trim().length === 0) {
        errors.push("Description is required");
    } else if (description.trim().length < 2) {
        errors.push("Description must be at least 2 characters");
    }

    if (!amount) {
        errors.push("Amount is required");
    } else {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.push("Amount must be a positive number");
        } else if (parsedAmount > 999999.99) {
            errors.push("Amount cannot exceed £999,999.99");
        }
    }

    if (!['sale', 'expense'].includes(type)) {
        errors.push("Type must be either 'sale' or 'expense'");
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors, valid: false });
    }

    next();
};

const validateId = (req, res, next) => {
    const id = req.params.id;
    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: "Valid ID is required" });
    }
    next();
};

const validateDateQuery = (req, res, next) => {
    const { date, limit, offset } = req.query;
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }
    
    if (limit && (isNaN(parseInt(limit)) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
        return res.status(400).json({ error: "Limit must be between 1 and 100" });
    }
    
    if (offset && (isNaN(parseInt(offset)) || parseInt(offset) < 0)) {
        return res.status(400).json({ error: "Offset must be non-negative" });
    }
    
    next();
};

const validateShiftTemplate = (req, res, next) => {
    const { name, start_time, duration_minutes } = req.body;
    const errors = [];

    if (!name || name.trim().length === 0) {
        errors.push("Name is required");
    } else if (name.trim().length < 2) {
        errors.push("Name must be at least 2 characters");
    } else if (name.trim().length > 50) {
        errors.push("Name cannot exceed 50 characters");
    }

    if (!start_time) {
        errors.push("Start time is required");
    } else if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(start_time)) {
        errors.push("Start time must be in HH:MM format");
    }

    if (!duration_minutes) {
        errors.push("Duration is required");
    } else {
        const duration = parseInt(duration_minutes);
        if (isNaN(duration) || duration <= 0) {
            errors.push("Duration must be a positive number");
        } else if (duration > 1440) {
            errors.push("Duration cannot exceed 24 hours");
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors, valid: false });
    }

    next();
};

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(err.status || 500).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await db.healthCheck();
        res.status(200).json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            version: process.env.npm_package_version || '1.0.0',
            database: dbHealth,
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

// =============================================================================
// USER PROFILE API
// =============================================================================

app.get('/api/me', (req, res) => {
    res.json({ 
        uid: req.user.uid, 
        email: req.user.email, 
        role: req.user.role, 
        status: req.user.status 
    });
});

// =============================================================================
// ANALYTICS API ROUTES
// =============================================================================

app.get('/api/analytics/real-time', async (req, res) => {
    try {
        const metrics = await analyticsService.getRealTimeSalesMetrics();
        res.json({ data: metrics });
    } catch (error) {
        console.error('Error fetching real-time analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

app.get('/api/analytics/forecast', adminOrSecondaryAdmin, async (req, res) => {
    try {
        const forecast = await analyticsService.getSalesForecast();
        res.json({ data: forecast });
    } catch (error) {
        console.error('Error fetching sales forecast:', error);
        res.status(500).json({ error: 'Failed to fetch forecast' });
    }
});

app.get('/api/analytics/peak-hours', adminOrSecondaryAdmin, async (req, res) => {
    try {
        const peakHours = await analyticsService.getPeakHoursAnalysis();
        res.json({ data: peakHours });
    } catch (error) {
        console.error('Error fetching peak hours analysis:', error);
        res.status(500).json({ error: 'Failed to fetch peak hours analysis' });
    }
});

// =============================================================================
// TRANSACTIONS API - COMPLETE WITH ALL FEATURES
// =============================================================================

app.get('/api/transactions', validateDateQuery, async (req, res) => {
    try {
        const { date, limit = 50, offset = 0, type, category, min_amount, max_amount } = req.query;
        
        let sql = `
            SELECT t.*, u.email as user_email, COALESCE(e.full_name, u.email) as user_name
            FROM transactions t 
            JOIN users u ON t.user_uid = u.uid 
            LEFT JOIN employees e ON t.user_uid = e.uid
            WHERE t.user_uid = $1 AND t.status = 'approved'
        `;
        let params = [req.user.uid];
        let paramCount = 1;
        
        if (date) {
            sql += ` AND DATE(t.transaction_date) = $${++paramCount}`;
            params.push(date);
        }
        
        if (type) {
            sql += ` AND t.type = $${++paramCount}`;
            params.push(type);
        }
        
        if (category) {
            sql += ` AND t.category = $${++paramCount}`;
            params.push(category);
        }
        
        if (min_amount) {
            sql += ` AND t.amount >= $${++paramCount}`;
            params.push(parseFloat(min_amount));
        }
        
        if (max_amount) {
            sql += ` AND t.amount <= $${++paramCount}`;
            params.push(parseFloat(max_amount));
        }
        
        sql += ` ORDER BY t.transaction_date DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await db.query(sql, params);
        
        // Get total count for pagination
        let countSql = `
            SELECT COUNT(*) as total 
            FROM transactions t
            WHERE t.user_uid = $1 AND t.status = 'approved'
        `;
        let countParams = [req.user.uid];
        let countParamCount = 1;
        
        if (date) {
            countSql += ` AND DATE(t.transaction_date) = $${++countParamCount}`;
            countParams.push(date);
        }
        
        if (type) {
            countSql += ` AND t.type = $${++countParamCount}`;
            countParams.push(type);
        }
        
        if (category) {
            countSql += ` AND t.category = $${++countParamCount}`;
            countParams.push(category);
        }
        
        if (min_amount) {
            countSql += ` AND t.amount >= $${++countParamCount}`;
            countParams.push(parseFloat(min_amount));
        }
        
        if (max_amount) {
            countSql += ` AND t.amount <= $${++countParamCount}`;
            countParams.push(parseFloat(max_amount));
        }
        
        const countResult = await db.query(countSql, countParams);
        
        res.json({
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

app.post('/api/transactions', validateTransaction, upload.single('receipt'), async (req, res) => {
    console.log('Received transaction request:', req.body); // Debug log
    
    const { description, amount, transaction_date, type, category } = req.body;
    
    // Enhanced validation
    if (!description || description.trim().length === 0) {
        return res.status(400).json({ error: "Description is required" });
    }
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: "Amount must be a positive number" });
    }
    
    if (!['sale', 'expense'].includes(type)) {
        return res.status(400).json({ error: "Type must be either 'sale' or 'expense'" });
    }

    try {
        const dateToInsert = transaction_date ? new Date(transaction_date) : new Date();
        const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const sql = `
            INSERT INTO transactions (user_uid, description, amount, transaction_date, type, category, receipt_image_url, status) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
            RETURNING *
        `;
        const params = [
            req.user.uid, 
            description.trim(), 
            parsedAmount, 
            dateToInsert, 
            type, 
            category || null, 
            receiptUrl,
            'approved'
        ];

        const { rows } = await db.query(sql, params);
        
        console.log('Transaction created:', rows[0]); // Debug log
        
        res.status(201).json({ 
            message: "Transaction created successfully",
            data: rows[0] 
        });
        
    } catch (err) {
        console.error("Database error:", err);
        res.status(500).json({ 
            error: "Failed to create transaction. Please try again.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


app.post('/api/transactions/validate', async (req, res) => {
    const { description, amount, type, category } = req.body;
    const errors = [];

    if (!description || description.trim().length === 0) {
        errors.push("Description is required");
    } else if (description.trim().length < 2) {
        errors.push("Description must be at least 2 characters");
    }

    if (!amount) {
        errors.push("Amount is required");
    } else {
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.push("Amount must be a positive number");
        } else if (parsedAmount > 999999.99) {
            errors.push("Amount cannot exceed £999,999.99");
        }
    }

    if (!['sale', 'expense'].includes(type)) {
        errors.push("Type must be either 'sale' or 'expense'");
    }

    if (type === 'sale') {
        const validSaleCategories = ['Dine-In', 'Takeout', 'Delivery App', 'Beverages', 'Other'];
        if (category && !validSaleCategories.includes(category)) {
            errors.push(`Invalid sale category. Valid options: ${validSaleCategories.join(', ')}`);
        }
    }
    
    res.json({
        valid: errors.length === 0,
        errors: errors
    });
});

app.post('/api/transactions/:id/request-delete', validateId, async (req, res) => {
    const transactionId = req.params.id;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ error: "Deletion reason must be at least 3 characters long." });
    }

    try {
        const checkSql = 'SELECT * FROM transactions WHERE id = $1 AND user_uid = $2';
        const checkResult = await db.query(checkSql, [transactionId, req.user.uid]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found or you don't have permission to delete it." });
        }

        const transaction = checkResult.rows[0];
        
        const insertSql = `
            INSERT INTO approval_requests (transaction_id, user_uid, user_email, request_type, reason, transaction_data) 
            VALUES ($1, $2, $3, 'delete', $4, $5) 
            RETURNING *
        `;
        
        const transactionData = JSON.stringify({
            id: transaction.id,
            description: transaction.description,
            amount: transaction.amount,
            type: transaction.type,
            category: transaction.category,
            transaction_date: transaction.transaction_date
        });
        
        const { rows } = await db.query(insertSql, [
            transactionId, 
            req.user.uid, 
            req.user.email, 
            reason.trim(),
            transactionData
        ]);

        await logActivity(req.user, 'REQUEST_DELETE', `Requested deletion of transaction: ${transaction.description} - £${transaction.amount} (Reason: ${reason.trim()})`);

        // Notify admins
        const adminSql = `SELECT uid FROM users WHERE role IN ('primary_admin', 'secondary_admin')`;
        const adminResult = await db.query(adminSql);
        
        for (const admin of adminResult.rows) {
            await createNotification(
                admin.uid,
                'Transaction Deletion Request',
                `${req.user.email} requested to delete transaction: ${transaction.description}`,
                'info',
                `/approval-requests`
            );
        }

        res.status(201).json({ 
            message: "Deletion request submitted successfully", 
            request: rows[0] 
        });

    } catch (err) {
        console.error("Error requesting transaction deletion:", err);
        res.status(500).json({ error: "Failed to submit deletion request. Please try again." });
    }
});

// FIXED: Edit transaction endpoint
app.put('/api/transactions/:id', validateId, validateTransaction, async (req, res) => {
    const transactionId = req.params.id;
    const { description, amount, transaction_date, category, reason } = req.body;

    if (!reason || reason.trim().length < 3) {
        return res.status(400).json({ 
            error: "Edit reason must be at least 3 characters long." 
        });
    }

    const parsedAmount = parseFloat(amount);

    try {
        // Check if user owns this transaction or is admin
        const checkSql = 'SELECT * FROM transactions WHERE id = $1 AND (user_uid = $2 OR $3 = ANY(ARRAY[\'primary_admin\', \'secondary_admin\']))';
        const checkResult = await db.query(checkSql, [transactionId, req.user.uid, req.user.role]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found or access denied." });
        }

        const oldData = checkResult.rows[0];

        const updateSql = `
            UPDATE transactions 
            SET description = $1, amount = $2, transaction_date = $3, category = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 
            RETURNING *
        `;
        const params = [description.trim(), parsedAmount, transaction_date, category, transactionId];
        const { rows } = await db.query(updateSql, params);

        let changes = [];
        if (oldData.description !== description.trim()) {
            changes.push(`Description: "${oldData.description}" → "${description.trim()}"`);
        }
        if (parseFloat(oldData.amount) !== parsedAmount) {
            changes.push(`Amount: £${parseFloat(oldData.amount).toFixed(2)} → £${parsedAmount.toFixed(2)}`);
        }
        if (new Date(oldData.transaction_date).getTime() !== new Date(transaction_date).getTime()) {
            changes.push(`Date: ${new Date(oldData.transaction_date).toLocaleDateString()} → ${new Date(transaction_date).toLocaleDateString()}`);
        }
        if ((oldData.category || '') !== (category || '')) {
            changes.push(`Category: "${oldData.category || 'N/A'}" → "${category || 'N/A'}"`);
        }
        
        const detailsString = changes.length > 0 ? changes.join('; ') : 'No data fields changed';

        await logActivity(req.user, 'UPDATE_TRANSACTION', `REASON: "${reason.trim()}". CHANGES: ${detailsString}. Transaction ID: ${transactionId}`, req);
        
        res.status(200).json({ 
            message: "Transaction updated successfully", 
            data: rows[0] 
        });

    } catch (err) {
        console.error("Error updating transaction:", err);
        res.status(500).json({ error: "Failed to update transaction. Please try again." });
    }
});

// DELETE transaction endpoint (admin only)
app.delete('/api/transactions/:id', validateId, adminOnly, async (req, res) => {
  const transactionId = req.params.id;

  try {
    // Fetch transaction
    const selectSql = 'SELECT * FROM transactions WHERE id = $1';
    const selectResult = await db.query(selectSql, [transactionId]);
    if (selectResult.rows.length === 0) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    const transaction = selectResult.rows[0];

    // Delete transaction
    const deleteSql = 'DELETE FROM transactions WHERE id = $1 RETURNING *';
    const { rows } = await db.query(deleteSql, [transactionId]);

    // Log activity
    await logActivity(req.user, 'DELETE_TRANSACTION', 
      `Deleted transaction: ${transaction.description} - £${transaction.amount}` , req);

    // Return response
    res.status(200).json({ message: "Transaction deleted successfully", data: rows[0] });
  } catch (err) {
    console.error("Error deleting transaction:", err);
    res.status(500).json({ error: "Failed to delete transaction. Please try again." });
  }
});

// Get all transactions (admin only)
app.get('/api/transactions/all', adminOnly, validateDateQuery, async (req, res) => {
    try {
        const { date, limit = 50, offset = 0, type, category, user_uid } = req.query;
        
        let sql = `
            SELECT t.*, u.email as user_email, COALESCE(e.full_name, u.email) as user_name
            FROM transactions t 
            JOIN users u ON t.user_uid = u.uid 
            LEFT JOIN employees e ON t.user_uid = e.uid
            WHERE t.status = 'approved'
        `;
        let params = [];
        let paramCount = 0;
        
        if (date) {
            sql += ` AND DATE(t.transaction_date) = $${++paramCount}`;
            params.push(date);
        }
        
        if (type) {
            sql += ` AND t.type = $${++paramCount}`;
            params.push(type);
        }
        
        if (category) {
            sql += ` AND t.category = $${++paramCount}`;
            params.push(category);
        }
        
        if (user_uid) {
            sql += ` AND t.user_uid = $${++paramCount}`;
            params.push(user_uid);
        }
        
        sql += ` ORDER BY t.transaction_date DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const result = await db.query(sql, params);
        
        let countSql = `
            SELECT COUNT(*) as total 
            FROM transactions t 
            WHERE t.status = 'approved'
        `;
        let countParams = [];
        let countParamCount = 0;
        
        if (date) {
            countSql += ` AND DATE(t.transaction_date) = $${++countParamCount}`;
            countParams.push(date);
        }
        
        if (type) {
            countSql += ` AND t.type = $${++countParamCount}`;
            countParams.push(type);
        }
        
        if (category) {
            countSql += ` AND t.category = $${++countParamCount}`;
            countParams.push(category);
        }
        
        if (user_uid) {
            countSql += ` AND t.user_uid = $${++countParamCount}`;
            countParams.push(user_uid);
        }
        
        const countResult = await db.query(countSql, countParams);
        
        res.json({
            data: result.rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
            }
        });
    } catch (error) {
        console.error('Error fetching all transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Export transactions
app.get('/api/transactions/export', adminOnly, async (req, res) => {
    try {
        const { start_date, end_date, format = 'csv' } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: "start_date and end_date are required" });
        }

        const sql = `
            SELECT 
                t.id,
                t.description,
                t.amount,
                t.type,
                t.category,
                t.transaction_date,
                u.email as user_email,
                COALESCE(e.full_name, u.email) as user_name
            FROM transactions t 
            JOIN users u ON t.user_uid = u.uid 
            LEFT JOIN employees e ON t.user_uid = e.uid
            WHERE t.status = 'approved' 
                AND DATE(t.transaction_date) BETWEEN $1 AND $2
            ORDER BY t.transaction_date DESC
        `;
        
        const { rows } = await db.query(sql, [start_date, end_date]);
        
        if (format === 'csv') {
            const csvHeaders = 'ID,Description,Amount,Type,Category,Date,User Email,User Name\n';
            const csvRows = rows.map(row => 
                `${row.id},"${row.description}",${row.amount},${row.type},"${row.category || ''}","${new Date(row.transaction_date).toISOString()}","${row.user_email}","${row.user_name}"`
            ).join('\n');
            const csvContent = csvHeaders + csvRows;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="transactions_${start_date}_to_${end_date}.csv"`);
            res.send(csvContent);
        } else {
            res.json({ data: rows });
        }
    } catch (error) {
        console.error('Error exporting transactions:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

// =============================================================================
// DASHBOARD API - FIXED FOR REFRESH ISSUES
// =============================================================================

app.get('/api/dashboard/summary', validateDateQuery, async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const sql = `
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'sale' AND DATE(transaction_date) = $1 THEN amount END), 0) as todays_sales,
                COALESCE(SUM(CASE WHEN type = 'expense' AND DATE(transaction_date) = $1 THEN amount END), 0) as todays_expenses,
                COALESCE(SUM(CASE WHEN type = 'sale' AND DATE(transaction_date) = $2 THEN amount END), 0) as yesterdays_sales,
                COALESCE(SUM(CASE WHEN type = 'expense' AND DATE(transaction_date) = $2 THEN amount END), 0) as yesterdays_expenses,
                COALESCE(COUNT(CASE WHEN type = 'sale' AND DATE(transaction_date) = $1 THEN 1 END), 0) as todays_sale_count,
                COALESCE(COUNT(CASE WHEN type = 'expense' AND DATE(transaction_date) = $1 THEN 1 END), 0) as todays_expense_count,
                COALESCE(AVG(CASE WHEN type = 'sale' AND DATE(transaction_date) = $1 THEN amount END), 0) as avg_sale_amount,
                COALESCE(MAX(CASE WHEN type = 'sale' AND DATE(transaction_date) = $1 THEN amount END), 0) as max_sale_amount
            FROM transactions 
            WHERE status = 'approved'
        `;
        const result = await db.query(sql, [date, yesterdayStr]);
        
        res.json({
            data: {
                todaysSales: parseFloat(result.rows[0].todays_sales || 0),
                todaysExpenses: parseFloat(result.rows[0].todays_expenses || 0),
                yesterdaysSales: parseFloat(result.rows[0].yesterdays_sales || 0),
                yesterdaysExpenses: parseFloat(result.rows[0].yesterdays_expenses || 0),
                todaysSaleCount: parseInt(result.rows[0].todays_sale_count || 0),
                todaysExpenseCount: parseInt(result.rows[0].todays_expense_count || 0),
                avgSaleAmount: parseFloat(result.rows[0].avg_sale_amount || 0),
                maxSaleAmount: parseFloat(result.rows[0].max_sale_amount || 0)
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard summary' });
    }
});

// Dashboard statistics
app.get('/api/dashboard/stats', adminOnly, async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const statsSql = `
            SELECT 
                (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
                (SELECT COUNT(*) FROM transactions WHERE DATE(transaction_date) = $1 AND status = 'approved') as todays_transactions,
                (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE DATE(transaction_date) = $1 AND type = 'sale' AND status = 'approved') as todays_sales,
                (SELECT COUNT(*) FROM availability_requests WHERE status = 'pending') as pending_requests,
                (SELECT COUNT(*) FROM time_entries WHERE clock_out_time IS NULL) as active_clock_ins,
                (SELECT COUNT(*) FROM approval_requests WHERE status = 'pending') as pending_approvals
        `;
        
        const { rows } = await db.query(statsSql, [today]);
        
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Error fetching stats:", err);
        res.status(500).json({ error: "Failed to fetch stats." });
    }
});

// =============================================================================
// EMPLOYEE MANAGEMENT API - COMPLETE
// =============================================================================

// server/index.js

app.get('/api/employees', async (req, res) => {
  try {
    const status = req.query.status || 'active';
    const sql = `
      SELECT
        u.uid, u.email, u.role, u.status, u.created_at,
        COALESCE(e.full_name,'')       AS full_name,
        COALESCE(e.pay_rate,0)         AS pay_rate,
        COALESCE(e.phone_number,'')    AS phone,
        COALESCE(e.address,'')         AS address,
        e.hire_date,
        COALESCE(e.job_role,'Staff')   AS position,
        COALESCE(e.department,'Restaurant') AS department
      FROM users u
      LEFT JOIN employees e ON u.uid = e.uid
      WHERE u.status = $1
      ORDER BY u.created_at DESC
    `;
    const { rows } = await db.query(sql, [status]);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});

app.get('/api/employees/:uid', validateUid, async (req, res) => {
  try {
    const sql = `
      SELECT
        u.uid, u.email, u.role, u.status, u.created_at,
        COALESCE(e.full_name,'')       AS full_name,
        COALESCE(e.pay_rate,0)         AS pay_rate,
        COALESCE(e.phone_number,'')    AS phone,
        COALESCE(e.address,'')         AS address,
        e.hire_date,
        COALESCE(e.job_role,'Staff')   AS position,
        COALESCE(e.department,'Restaurant') AS department,
        COALESCE(e.emergency_contact_name,'') AS emergency_contact_name,
        COALESCE(e.emergency_contact_phone,'') AS emergency_contact_phone
      FROM users u
      LEFT JOIN employees e ON u.uid = e.uid
      WHERE u.uid = $1
    `;
    const { rows } = await db.query(sql, [req.params.uid]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found.' });
    res.json({ data: rows[0] });
  } catch {
    res.status(500).json({ error: 'Failed to fetch employee.' });
  }
});

// FIXED: Update employee endpoint
// Employee updates
app.put('/api/employees/:uid', validateUid, validateEmployee, async (req, res) => {
  try {
    const {
      full_name, phone, address, pay_rate,
      position, department, hire_date,
      emergency_contact_name, emergency_contact_phone
    } = req.body;

    const upsertSql = `
      INSERT INTO employees
        (uid, full_name, phone_number, address, pay_rate, job_role, department, hire_date, emergency_contact_name, emergency_contact_phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(uid) DO UPDATE SET
        full_name=EXCLUDED.full_name,
        phone_number=EXCLUDED.phone_number,
        address=EXCLUDED.address,
        pay_rate=EXCLUDED.pay_rate,
        job_role=EXCLUDED.job_role,
        department=EXCLUDED.department,
        hire_date=EXCLUDED.hire_date,
        emergency_contact_name=EXCLUDED.emergency_contact_name,
        emergency_contact_phone=EXCLUDED.emergency_contact_phone,
        updated_at=NOW()
      RETURNING *;
    `;
    const params = [
      req.params.uid, full_name, phone, address,
      pay_rate, position, department, hire_date,
      emergency_contact_name, emergency_contact_phone
    ];
    const { rows } = await db.query(upsertSql, params);
    
    // Add this
    await logActivity(req.user, 'UPDATE_EMPLOYEE',
      `Updated employee profile: ${full_name || 'Unknown'}`);

    res.json({ message: 'Employee updated', data: rows[0] });
  } catch (err) {
    console.error("Error updating employee:", err);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
});

// Employee performance metrics
app.get('/api/employees/:uid/performance', adminOnly, async (req, res) => {
    const { uid } = req.params;
    const { start_date, end_date } = req.query;
    
    try {
        const sql = `
            SELECT 
                COUNT(t.id) as total_transactions,
                COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.amount END), 0) as total_sales,
                COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as total_expenses,
                COALESCE(AVG(CASE WHEN t.type = 'sale' THEN t.amount END), 0) as avg_sale_amount,
                COUNT(te.id) as total_shifts,
                COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_time))/3600), 0) as total_hours
            FROM users u
            LEFT JOIN transactions t ON u.uid = t.user_uid 
                AND t.status = 'approved'
                AND ($3::date IS NULL OR DATE(t.transaction_date) >= $3)
                AND ($4::date IS NULL OR DATE(t.transaction_date) <= $4)
            LEFT JOIN time_entries te ON u.uid = te.user_uid 
                AND te.clock_out_time IS NOT NULL
                AND ($3::date IS NULL OR DATE(te.clock_in_time) >= $3)
                AND ($4::date IS NULL OR DATE(te.clock_in_time) <= $4)
            WHERE u.uid = $1
            GROUP BY u.uid
        `;
        
        const { rows } = await db.query(sql, [uid, uid, start_date || null, end_date || null]);
        
        res.json({ data: rows[0] || {} });
    } catch (err) {
        console.error("Error fetching employee performance:", err);
        res.status(500).json({ error: "Failed to fetch employee performance." });
    }
});

// =============================================================================
// USER MANAGEMENT API - COMPLETE
// =============================================================================

app.get('/api/users', async (req, res) => {
    try {
        const { role, status = 'active' } = req.query;
        
        let sql = 'SELECT uid, email, role, status, created_at FROM users WHERE status = $1';
        let params = [status];
        let paramCount = 1;
        
        if (role) {
            sql += ` AND role = $${++paramCount}`;
            params.push(role);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).json({ error: "Failed to fetch users." });
    }
});

app.post('/api/users', async (req, res) => {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
        return res.status(400).json({ error: "Email, password, and role are required." });
    }

    if (!['staff', 'secondary_admin'].includes(role)) {
        return res.status(400).json({ error: "Role must be either 'staff' or 'secondary_admin'." });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    try {
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password,
            emailVerified: false
        });

        const sql = 'INSERT INTO users (uid, email, role, status) VALUES ($1, $2, $3, $4) RETURNING *';
        const { rows } = await db.query(sql, [userRecord.uid, email, role, 'active']);

        await logActivity(req.user, 'CREATE_USER', `Created user: ${email} with role: ${role}`);

        // Create notification for new user
        await createNotification(
            userRecord.uid,
            'Welcome to MR BURGER',
            'Your account has been created. Please log in to get started.',
            'info'
        );

        res.status(201).json({ 
            message: "User created successfully", 
            data: { uid: userRecord.uid, email, role, status: 'active' } 
        });
    } catch (err) {
        console.error("Error creating user:", err);
        
        if (err.code === 'auth/email-already-exists') {
            res.status(400).json({ error: "A user with this email already exists." });
        } else if (err.code === '23505') {
            res.status(400).json({ error: "User already exists in the system." });
        } else {
            res.status(500).json({ error: "Failed to create user. Please try again." });
        }
    }
});

app.put('/api/users/:uid', async (req, res) => {
    const { uid } = req.params;
    const { role, status } = req.body;

    if (uid === req.user.uid) {
        return res.status(400).json({ error: "You cannot modify your own account." });
    }

    try {
        const userSql = 'SELECT * FROM users WHERE uid = $1';
        const userResult = await db.query(userSql, [uid]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = userResult.rows[0];

        if (user.role === 'primary_admin') {
            return res.status(403).json({ error: "Cannot modify primary admin account." });
        }

        const updateSql = 'UPDATE users SET role = $1, status = $2 WHERE uid = $3 RETURNING *';
        const { rows } = await db.query(updateSql, [role || user.role, status || user.status, uid]);

        await logActivity(req.user, 'UPDATE_USER', `Updated user: ${user.email} - Role: ${role || user.role}, Status: ${status || user.status}`);

        res.json({ 
            message: "User updated successfully", 
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ error: "Failed to update user." });
    }
});

app.delete('/api/users/:uid', async (req, res) => {
    const { uid } = req.params;

    if (uid === req.user.uid) {
        return res.status(400).json({ error: "You cannot delete your own account." });
    }

    try {
        const userSql = 'SELECT * FROM users WHERE uid = $1';
        const userResult = await db.query(userSql, [uid]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = userResult.rows[0];

        if (user.role === 'primary_admin') {
            return res.status(403).json({ error: "Cannot delete primary admin account." });
        }

        await admin.auth().deleteUser(uid);

        const deleteSql = 'DELETE FROM users WHERE uid = $1 RETURNING *';
        const { rows } = await db.query(deleteSql, [uid]);

        await logActivity(req.user, 'DELETE_USER', `Deleted user: ${user.email} (${user.role})`);

        res.json({ message: "User deleted successfully", data: rows[0] });
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ error: "Failed to delete user. Please try again." });
    }
});

app.post('/api/users/make-admin', adminOnly, async (req, res) => {
    const { uid, role } = req.body;

    if (!uid || !role) {
        return res.status(400).json({ error: "UID and role are required." });
    }

    if (!['secondary_admin', 'staff'].includes(role)) {
        return res.status(400).json({ error: "Role must be either 'secondary_admin' or 'staff'." });
    }

    if (uid === req.user.uid) {
        return res.status(400).json({ error: "You cannot change your own role." });
    }

    try {
        const userSql = 'SELECT * FROM users WHERE uid = $1';
        const userResult = await db.query(userSql, [uid]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = userResult.rows[0];

        if (user.role === 'primary_admin') {
            return res.status(403).json({ error: "Cannot change primary admin role." });
        }

        const updateSql = 'UPDATE users SET role = $1 WHERE uid = $2 RETURNING *';
        const { rows } = await db.query(updateSql, [role, uid]);

        await logActivity(req.user, 'CHANGE_USER_ROLE', `Changed ${user.email} role from ${user.role} to ${role}`);

        // Notify user of role change
        await createNotification(
            uid,
            'Role Updated',
            `Your role has been changed to ${role}`,
            'info'
        );

        res.json({ 
            message: "User role updated successfully", 
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error updating user role:", err);
        res.status(500).json({ error: "Failed to update user role." });
    }
});

// =============================================================================
// TIME CLOCK API - COMPLETE AND FIXED (NO DUPLICATES)
// =============================================================================

// Clock-in route
app.post('/api/time-clock/clock-in', authMiddleware, async (req, res) => {
    const { notes, location } = req.body;

    try {
        console.log('Clock-in attempt for user:', req.user?.uid);

        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Check if user is already clocked in - FIXED: Use clock_in_timestamp consistently
        const checkSql = `
            SELECT * FROM time_entries
            WHERE user_uid = $1 AND clock_out_time IS NULL
            ORDER BY clock_in_timestamp DESC
            LIMIT 1
        `;
        const checkResult = await db.query(checkSql, [req.user.uid]);
        
        if (checkResult.rows.length > 0) {
            return res.status(400).json({ 
                error: "You are already clocked in. Please clock out first." 
            });
        }

        // Insert new time entry
        const sql = `
            INSERT INTO time_entries (user_uid, user_email, clock_in_timestamp, notes, location)
            VALUES ($1, $2, NOW(), $3, $4)
            RETURNING *
        `;
        const { rows } = await db.query(sql, [
            req.user.uid, 
            req.user.email, 
            notes || null, 
            location || 'Restaurant'
        ]);

        console.log('Clock-in successful:', rows[0].id);

        try {
            await logActivity(req.user, 'CLOCK_IN', 
                `Clocked in${notes ? ` (${notes})` : ''}${location ? ` at ${location}` : ''}`, req);
        } catch (logError) {
            console.error('Failed to log activity:', logError.message);
        }

        res.status(201).json({ 
            message: "Successfully clocked in",
            data: rows[0] 
        });
    } catch (err) {
        console.error("Clock-in error:", {
            error: err.message,
            user: req.user?.uid
        });
        res.status(500).json({ 
            error: "Failed to clock in. Please try again."
        });
    }
});

// Clock-out route - SINGLE VERSION ONLY
app.post('/api/time-clock/clock-out', authMiddleware, async (req, res) => {
    const { notes } = req.body;
    
    try {
        console.log('Clock-out attempt for user:', req.user?.uid);

        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Find the active clock-in entry - FIXED: Use clock_in_timestamp consistently
        const checkSql = `
            SELECT * FROM time_entries
            WHERE user_uid = $1 AND clock_out_time IS NULL
            ORDER BY clock_in_timestamp DESC
            LIMIT 1
        `;
        const checkResult = await db.query(checkSql, [req.user.uid]);
        
        if (checkResult.rows.length === 0) {
            return res.status(400).json({ 
                error: "You are not currently clocked in." 
            });
        }

        const timeEntry = checkResult.rows[0];
        
        // Update with clock-out time - FIXED: Use clock_in_timestamp in calculation
        const updateSql = `
            UPDATE time_entries
            SET clock_out_time = NOW(),
                notes = COALESCE($2, notes),
                total_hours = EXTRACT(EPOCH FROM (NOW() - clock_in_timestamp))/3600
            WHERE id = $1
            RETURNING *
        `;
        const { rows } = await db.query(updateSql, [timeEntry.id, notes || null]);

        if (rows.length === 0) {
            throw new Error('Failed to update time entry');
        }

        const updatedEntry = rows[0];
        console.log('Clock-out successful:', updatedEntry.id);

        // Calculate hours for logging - FIXED: Use clock_in_timestamp
        const clockInTime = new Date(timeEntry.clock_in_timestamp);
        const clockOutTime = new Date(updatedEntry.clock_out_time);
        const hoursWorked = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2);

        try {
            await logActivity(req.user, 'CLOCK_OUT', 
                `Clocked out (${hoursWorked} hours)${notes ? ` (${notes})` : ''}`, req);
        } catch (logError) {
            console.error('Failed to log activity:', logError.message);
        }

        res.json({ 
            message: "Successfully clocked out",
            data: updatedEntry
        });
    } catch (err) {
        console.error("Clock-out error:", {
            error: err.message,
            user: req.user?.uid
        });
        res.status(500).json({ 
            error: "Failed to clock out. Please try again."
        });
    }
});

// Status check route - SINGLE VERSION WITH AUTH
app.get('/api/time-clock/status', authMiddleware, async (req, res) => {
    try {
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: "Authentication required" });
        }

        const sql = `
            SELECT * FROM time_entries
            WHERE user_uid = $1 AND clock_out_time IS NULL
            ORDER BY clock_in_timestamp DESC
            LIMIT 1
        `;
        const { rows } = await db.query(sql, [req.user.uid]);
        
        res.json({
            clockedIn: rows.length > 0,
            currentEntry: rows.length > 0 ? rows[0] : null
        });
    } catch (err) {
        console.error("Status check error:", err);
        res.status(500).json({ error: "Failed to check status." });
    }
});

// Break start route - FIXED: Added authMiddleware and consistent column names
app.post('/api/time-clock/break-start', authMiddleware, async (req, res) => {
    try {
        console.log('Break-start attempt for user:', req.user?.uid); // Debug log

        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Find active time entry that's not already on break - FIXED: Use clock_in_timestamp
        const checkSql = `
            SELECT * FROM time_entries 
            WHERE user_uid = $1 
              AND clock_out_time IS NULL 
              AND break_start_time IS NULL
            ORDER BY clock_in_timestamp DESC 
            LIMIT 1
        `;
        const checkResult = await db.query(checkSql, [req.user.uid]);
        
        if (checkResult.rows.length === 0) {
            return res.status(400).json({ 
                error: "You must be clocked in and not already on break to start a break." 
            });
        }

        const timeEntry = checkResult.rows[0];
        console.log('Found time entry for break:', timeEntry.id); // Debug log

        // Update the entry with break start time
        const updateSql = `
            UPDATE time_entries 
            SET break_start_time = NOW()
            WHERE id = $1 
            RETURNING *
        `;
        const { rows } = await db.query(updateSql, [timeEntry.id]);

        if (rows.length === 0) {
            throw new Error('Failed to update time entry with break start');
        }

        console.log('Break started successfully:', rows[0].id); // Debug log

        // Log activity safely
        try {
            await logActivity(req.user, 'BREAK_START', 'Started break', req);
        } catch (logError) {
            console.error('Failed to log activity:', logError.message);
        }

        res.json({ 
            message: "Break started successfully",
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error starting break:", {
            error: err.message,
            stack: err.stack,
            user: req.user?.uid
        });
        res.status(500).json({ 
            error: "Failed to start break. Please try again.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Break end route - FIXED: Added authMiddleware and consistent column names
app.post('/api/time-clock/break-end', authMiddleware, async (req, res) => {
    try {
        console.log('Break-end attempt for user:', req.user?.uid); // Debug log

        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: "Authentication required" });
        }

        // Find active break entry - FIXED: Use clock_in_timestamp
        const checkSql = `
            SELECT * FROM time_entries 
            WHERE user_uid = $1 
              AND clock_out_time IS NULL 
              AND break_start_time IS NOT NULL 
              AND break_end_time IS NULL
            ORDER BY clock_in_timestamp DESC 
            LIMIT 1
        `;
        const checkResult = await db.query(checkSql, [req.user.uid]);
        
        if (checkResult.rows.length === 0) {
            return res.status(400).json({ 
                error: "You must be on an active break to end it." 
            });
        }

        const timeEntry = checkResult.rows[0];
        console.log('Found break entry to end:', timeEntry.id); // Debug log

        // Update the entry with break end time
        const updateSql = `
            UPDATE time_entries 
            SET break_end_time = NOW()
            WHERE id = $1 
            RETURNING *
        `;
        const { rows } = await db.query(updateSql, [timeEntry.id]);

        if (rows.length === 0) {
            throw new Error('Failed to update time entry with break end');
        }

        console.log('Break ended successfully:', rows[0].id); // Debug log

        // Log activity safely
        try {
            await logActivity(req.user, 'BREAK_END', 'Ended break', req);
        } catch (logError) {
            console.error('Failed to log activity:', logError.message);
        }

        res.json({ 
            message: "Break ended successfully",
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error ending break:", {
            error: err.message,
            stack: err.stack,
            user: req.user?.uid
        });
        res.status(500).json({ 
            error: "Failed to end break. Please try again.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// Get user's time entries for a date range
app.get('/api/time-clock/entries', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!req.user || !req.user.uid) {
            return res.status(401).json({ error: "Authentication required" });
        }

        let sql = `
            SELECT * FROM time_entries 
            WHERE user_uid = $1
        `;
        let params = [req.user.uid];

        if (start_date && end_date) {
            sql += ` AND clock_in_timestamp >= $2 AND clock_in_timestamp <= $3`;
            params.push(start_date, end_date);
        }

        sql += ` ORDER BY clock_in_timestamp DESC`;

        const { rows } = await db.query(sql, params);
        
        res.json({ 
            data: rows 
        });
    } catch (err) {
        console.error("Error fetching time entries:", err);
        res.status(500).json({ error: "Failed to fetch time entries." });
    }
});

// =============================================================================
// SCHEDULE AND AVAILABILITY API - COMPLETE FOR STAFF ACCESS
// =============================================================================

app.get('/api/my-schedule', async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        let sql = `
            SELECT rs.*, st.name as shift_name, st.start_time, st.duration_minutes,
                   (st.start_time::time + (st.duration_minutes || ' minutes')::interval)::time as end_time
            FROM rota_shifts rs
            JOIN shift_templates st ON rs.shift_template_id = st.id
            WHERE rs.user_uid = $1
        `;
        let params = [req.user.uid];
        let paramCount = 1;
        
        if (start_date) {
            sql += ` AND rs.shift_date >= $${++paramCount}`;
            params.push(start_date);
        } else {
            sql += ` AND rs.shift_date >= CURRENT_DATE - INTERVAL '7 days'`;
        }
        
        if (end_date) {
            sql += ` AND rs.shift_date <= $${++paramCount}`;
            params.push(end_date);
        }
        
        sql += ` ORDER BY rs.shift_date ASC, st.start_time ASC`;
        
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching schedule:", err);
        res.status(500).json({ error: "Failed to fetch schedule." });
    }
});

app.get('/api/availability', async (req, res) => {
    try {
        const { status } = req.query;
        
        let sql = `
            SELECT * FROM availability_requests 
            WHERE user_uid = $1
        `;
        let params = [req.user.uid];
        let paramCount = 1;
        
        if (status) {
            sql += ` AND status = $${++paramCount}`;
            params.push(status);
        }
        
        sql += ` ORDER BY start_date DESC`;
        
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching availability:", err);
        res.status(500).json({ error: "Failed to fetch availability requests." });
    }
});

// Secure Availability Requests – index.js

// CREATE AVAILABILITY REQUEST
app.post('/api/availability', authMiddleware, async (req, res) => {
  const { start_date, end_date, reason, request_type = 'time_off' } = req.body;

  // Validate required fields
  if (!start_date || !end_date || !reason || !reason.trim()) {
    return res
      .status(400)
      .json({ error: "Start date, end date, and reason are required." });
  }

  // Ensure logical date order
  if (new Date(start_date) > new Date(end_date)) {
    return res
      .status(400)
      .json({ error: "Start date cannot be after end date." });
  }

  try {
    // Insert the request linked to the authenticated user (req.user)
    const sql = `
      INSERT INTO availability_requests
        (user_uid, user_email, start_date, end_date, reason, request_type, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `;
    const params = [
      req.user.uid,
      req.user.email,
      start_date,
      end_date,
      reason.trim(),
      request_type.trim()
    ];
    const { rows } = await db.query(sql, params);

    // Log the creation in your activity logs
    await logActivity(
      req.user,
      'CREATE_AVAILABILITY_REQUEST',
      `Requested ${request_type.trim()}: ${start_date} to ${end_date} (${reason.trim()})`
    );

    // Notify all administrators of the new request
    const adminSql = `
      SELECT uid FROM users WHERE role IN ('primary_admin', 'secondary_admin')
    `;
    const adminResult = await db.query(adminSql);

    for (const admin of adminResult.rows) {
      await createNotification(
        admin.uid,
        'New Availability Request',
        `${req.user.email} requested ${request_type.trim()} from ${start_date} to ${end_date}`,
        'info',
        '/availability-requests'
      );
    }

    // Return the newly created request
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    console.error("Error creating availability request:", err);
    res
      .status(500)
      .json({ error: "Failed to create availability request." });
  }
});

app.delete('/api/availability/:id', validateId, async (req, res) => {
    const requestId = req.params.id;

    try {
        const checkSql = 'SELECT * FROM availability_requests WHERE id = $1 AND user_uid = $2';
        const checkResult = await db.query(checkSql, [requestId, req.user.uid]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Availability request not found or you don't have permission to delete it." });
        }

        const request = checkResult.rows[0];
        
        if (request.status !== 'pending') {
            return res.status(400).json({ error: "Cannot delete a request that has already been processed." });
        }

        const deleteSql = 'DELETE FROM availability_requests WHERE id = $1 RETURNING *';
        const { rows } = await db.query(deleteSql, [requestId]);

        await logActivity(req.user, 'DELETE_AVAILABILITY_REQUEST', `Deleted availability request: ${request.start_date} to ${request.end_date}`);

        res.json({ message: "Availability request deleted successfully", data: rows[0] });
    } catch (err) {
        console.error("Error deleting availability request:", err);
        res.status(500).json({ error: "Failed to delete availability request." });
    }
});

// FIXED: Availability requests for admin
app.get('/api/availability/pending', adminOnly, async (req, res) => {
    try {
        const sql = `
            SELECT ar.*, u.email, COALESCE(e.full_name, u.email) as full_name
            FROM availability_requests ar
            JOIN users u ON ar.user_uid = u.uid
            LEFT JOIN employees e ON ar.user_uid = e.uid
            WHERE ar.status = 'pending'
            ORDER BY ar.created_at ASC
        `;
        
        const { rows } = await db.query(sql);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching pending availability requests:", err);
        res.status(500).json({ error: "Failed to fetch pending availability requests." });
    }
});

app.get('/api/availability/rota', adminOnly, async (req, res) => {
    try {
        const { start_date, end_date, week_start } = req.query;
        
        let startDate, endDate;
        
        if (week_start) {
            startDate = week_start;
            const end = new Date(week_start);
            end.setDate(end.getDate() + 6);
            endDate = end.toISOString().split('T')[0];
        } else if (start_date && end_date) {
            startDate = start_date;
            endDate = end_date;
        } else {
            return res.status(400).json({ error: "Either week_start OR start_date and end_date parameters are required" });
        }

        const sql = `
            SELECT ar.*, u.email, COALESCE(e.full_name, u.email) as full_name
            FROM availability_requests ar
            JOIN users u ON ar.user_uid = u.uid
            LEFT JOIN employees e ON ar.user_uid = e.uid
            WHERE ar.start_date >= $1 AND ar.end_date <= $2
                AND ar.status = 'approved'
            ORDER BY ar.start_date, e.full_name
        `;
        
        const { rows } = await db.query(sql, [startDate, endDate]);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching rota availability:", err);
        res.status(500).json({ error: "Failed to fetch rota availability." });
    }
});

app.post('/api/availability/:id/approve', validateId, adminOnly, async (req, res) => {
    const requestId = req.params.id;
    const { admin_notes } = req.body;

    try {
        const checkSql = 'SELECT * FROM availability_requests WHERE id = $1 AND status = $2';
        const checkResult = await db.query(checkSql, [requestId, 'pending']);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Availability request not found or already processed." });
        }

        const request = checkResult.rows[0];

        const updateSql = `
            UPDATE availability_requests 
            SET status = 'approved', admin_uid = $1, admin_notes = $2, processed_at = NOW() 
            WHERE id = $3 
            RETURNING *
        `;
        const { rows } = await db.query(updateSql, [req.user.uid, admin_notes || null, requestId]);

        await logActivity(req.user, 'APPROVE_AVAILABILITY', `Approved availability request: ${request.start_date} to ${request.end_date} (${request.user_email})`);

        // Notify user
        await createNotification(
            request.user_uid,
            'Availability Request Approved',
            `Your ${request.request_type} request from ${request.start_date} to ${request.end_date} has been approved`,
            'success'
        );

        res.json({ 
            message: "Availability request approved successfully", 
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error approving availability request:", err);
        res.status(500).json({ error: "Failed to approve availability request." });
    }
});

app.post('/api/availability/:id/reject', validateId, adminOnly, async (req, res) => {
    const requestId = req.params.id;
    const { admin_notes } = req.body;

    if (!admin_notes || admin_notes.trim().length < 3) {
        return res.status(400).json({ error: "Admin notes are required when rejecting a request (minimum 3 characters)." });
    }

    try {
        const checkSql = 'SELECT * FROM availability_requests WHERE id = $1 AND status = $2';
        const checkResult = await db.query(checkSql, [requestId, 'pending']);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Availability request not found or already processed." });
        }

        const request = checkResult.rows[0];

        const updateSql = `
            UPDATE availability_requests 
            SET status = 'rejected', admin_uid = $1, admin_notes = $2, processed_at = NOW() 
            WHERE id = $3 
            RETURNING *
        `;
        const { rows } = await db.query(updateSql, [req.user.uid, admin_notes.trim(), requestId]);

        await logActivity(req.user, 'REJECT_AVAILABILITY', `Rejected availability request: ${request.start_date} to ${request.end_date} (${request.user_email}). Reason: ${admin_notes.trim()}`);

        // Notify user
        await createNotification(
            request.user_uid,
            'Availability Request Rejected',
            `Your ${request.request_type} request from ${request.start_date} to ${request.end_date} has been rejected. Reason: ${admin_notes.trim()}`,
            'warning'
        );

        res.json({ 
            message: "Availability request rejected successfully", 
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error rejecting availability request:", err);
        res.status(500).json({ error: "Failed to reject availability request." });
    }
});

// =============================================================================
// APPROVAL QUEUE API - COMPLETE
// =============================================================================

app.get('/api/approval-requests', async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        
        const sql = `
            SELECT ar.*, t.description, t.amount, t.type, t.category, t.transaction_date,
                   u.email as requester_email, COALESCE(e.full_name, u.email) as requester_name
            FROM approval_requests ar
            LEFT JOIN transactions t ON ar.transaction_id = t.id
            JOIN users u ON ar.user_uid = u.uid
            LEFT JOIN employees e ON ar.user_uid = e.uid
            WHERE ar.status = $1
            ORDER BY ar.created_at DESC
        `;
        const { rows } = await db.query(sql, [status]);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching approval requests:", err);
        res.status(500).json({ error: "Failed to fetch approval requests." });
    }
});

app.post('/api/transactions/:id/approve-delete', validateId, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const { admin_notes } = req.body;

    try {
        const requestSql = 'SELECT * FROM approval_requests WHERE transaction_id = $1 AND status = $2';
        const requestResult = await db.query(requestSql, [transactionId, 'pending']);
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: "No pending deletion request found for this transaction." });
        }

        const approvalRequest = requestResult.rows[0];

        const transactionSql = 'SELECT * FROM transactions WHERE id = $1';
        const transactionResult = await db.query(transactionSql, [transactionId]);
        
        if (transactionResult.rows.length === 0) {
            return res.status(404).json({ error: "Transaction not found." });
        }

        const transaction = transactionResult.rows[0];

        const deleteSql = 'DELETE FROM transactions WHERE id = $1 RETURNING *';
        await db.query(deleteSql, [transactionId]);

        const updateRequestSql = `
            UPDATE approval_requests 
            SET status = 'approved', admin_uid = $1, admin_notes = $2, processed_at = NOW() 
            WHERE id = $3 
            RETURNING *
        `;
        const { rows } = await db.query(updateRequestSql, [req.user.uid, admin_notes || null, approvalRequest.id]);

        await logActivity(req.user, 'APPROVE_DELETE', `Approved deletion of transaction: ${transaction.description} - £${parseFloat(transaction.amount).toFixed(2)} (Requested by: ${approvalRequest.user_email})`);

        // Notify requester
        await createNotification(
            approvalRequest.user_uid,
            'Transaction Deletion Approved',
            `Your request to delete transaction "${transaction.description}" has been approved`,
            'success'
        );

        res.json({ 
            message: "Transaction deletion approved and processed successfully", 
            data: rows[0] 
        });

    } catch (err) {
        console.error("Error approving transaction deletion:", err);
        res.status(500).json({ error: "Failed to approve transaction deletion." });
    }
});

app.post('/api/transactions/:id/reject-delete', validateId, adminOnly, async (req, res) => {
    const transactionId = req.params.id;
    const { admin_notes } = req.body;

    if (!admin_notes || admin_notes.trim().length < 3) {
        return res.status(400).json({ error: "Admin notes are required when rejecting a request (minimum 3 characters)." });
    }

    try {
        const requestSql = 'SELECT * FROM approval_requests WHERE transaction_id = $1 AND status = $2';
        const requestResult = await db.query(requestSql, [transactionId, 'pending']);
        
        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: "No pending deletion request found for this transaction." });
        }

        const approvalRequest = requestResult.rows[0];

        const updateRequestSql = `
            UPDATE approval_requests 
            SET status = 'rejected', admin_uid = $1, admin_notes = $2, processed_at = NOW() 
            WHERE id = $3 
            RETURNING *
        `;
        const { rows } = await db.query(updateRequestSql, [req.user.uid, admin_notes.trim(), approvalRequest.id]);

        await logActivity(req.user, 'REJECT_DELETE', `Rejected deletion request for transaction ID ${transactionId} (Requested by: ${approvalRequest.user_email}). Reason: ${admin_notes.trim()}`);

        // Notify requester
        await createNotification(
            approvalRequest.user_uid,
            'Transaction Deletion Rejected',
            `Your request to delete a transaction has been rejected. Reason: ${admin_notes.trim()}`,
            'warning'
        );

        res.json({ 
            message: "Transaction deletion request rejected successfully", 
            data: rows[0] 
        });

    } catch (err) {
        console.error("Error rejecting transaction deletion:", err);
        res.status(500).json({ error: "Failed to reject transaction deletion request." });
    }
});

// =============================================================================
// REPORTS API - UPDATED AND FIXED
// =============================================================================

// Main timesheet report - FIXED with correct column names and calculations
app.get('/api/reports/timesheet', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, user_uid, export_format } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: "start_date and end_date are required" });
        }

        let sql = `
            SELECT 
                u.uid,
                u.email,
                COALESCE(e.full_name, u.email) as full_name,
                COALESCE(e.pay_rate, 0) as pay_rate,
                COALESCE(e.job_role, 'Staff') as position,
                COUNT(te.id) as total_shifts,
                -- FIXED: Use clock_in_timestamp and proper break calculation
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                            COALESCE(
                                CASE 
                                    WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                        EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                    ELSE 0
                                END, 0
                            )
                        ELSE 0
                    END
                ), 0) as total_hours,
                COALESCE(SUM(te.overtime_hours), 0) as total_overtime,
                -- FIXED: Calculate pay with break deductions
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            (EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                            COALESCE(
                                CASE 
                                    WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                        EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                    ELSE 0
                                END, 0
                            )) * COALESCE(e.pay_rate, 0)
                        ELSE 0
                    END
                ), 0) as total_pay
            FROM users u
            LEFT JOIN employees e ON u.uid = e.uid
            LEFT JOIN time_entries te ON u.uid = te.user_uid 
                AND te.clock_in_timestamp >= $1::date 
                AND te.clock_in_timestamp < $2::date + INTERVAL '1 day'
                AND te.clock_out_time IS NOT NULL
            WHERE u.status = 'active'
        `;
        let params = [start_date, end_date];
        let paramCount = 2;
        
        if (user_uid) {
            sql += ` AND u.uid = $${++paramCount}`;
            params.push(user_uid);
        }
        
        sql += ` GROUP BY u.uid, u.email, e.full_name, e.pay_rate, e.job_role ORDER BY e.full_name, u.email`;
        
        const { rows } = await db.query(sql, params);
        
        if (export_format === 'csv') {
            const csvHeaders = 'Name,Email,Position,Total Shifts,Total Hours,Overtime Hours,Pay Rate,Total Pay\n';
            const csvRows = rows.map(row => 
                `"${row.full_name}","${row.email}","${row.position}",${row.total_shifts},${parseFloat(row.total_hours).toFixed(2)},${parseFloat(row.total_overtime).toFixed(2)},${parseFloat(row.pay_rate).toFixed(2)},${parseFloat(row.total_pay).toFixed(2)}`
            ).join('\n');
            const csvContent = csvHeaders + csvRows;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="timesheet_${start_date}_to_${end_date}.csv"`);
            res.send(csvContent);
        } else {
            res.json({ data: rows });
        }
    } catch (err) {
        console.error("Error generating timesheet report:", err);
        res.status(500).json({ error: "Failed to generate timesheet report." });
    }
});

// Detailed timesheet export - FIXED with correct column names
app.get('/api/reports/timesheet/export', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, user_uid } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: "start_date and end_date are required" });
        }

        let sql = `
            SELECT 
                COALESCE(e.full_name, u.email) as "Employee Name",
                u.email as "Email",
                COALESCE(e.job_role, 'Staff') as "Position",
                DATE(te.clock_in_timestamp) as "Date",
                te.clock_in_timestamp::time as "Clock In",
                te.clock_out_time::time as "Clock Out",
                -- FIXED: Calculate net hours with break deductions
                CASE 
                    WHEN te.clock_out_time IS NOT NULL THEN
                        EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                        COALESCE(
                            CASE 
                                WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                    EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                ELSE 0
                            END, 0
                        )
                    ELSE 0
                END as "Hours Worked",
                COALESCE(e.pay_rate, 0) as "Pay Rate",
                -- FIXED: Calculate pay with break deductions
                CASE 
                    WHEN te.clock_out_time IS NOT NULL THEN
                        (EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                        COALESCE(
                            CASE 
                                WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                    EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                ELSE 0
                            END, 0
                        )) * COALESCE(e.pay_rate, 0)
                    ELSE 0
                END as "Total Pay",
                te.notes as "Notes"
            FROM time_entries te
            JOIN users u ON te.user_uid = u.uid
            LEFT JOIN employees e ON te.user_uid = e.uid
            WHERE te.clock_in_timestamp >= $1::date 
                AND te.clock_in_timestamp < $2::date + INTERVAL '1 day'
                AND te.clock_out_time IS NOT NULL
        `;
        let params = [start_date, end_date];
        let paramCount = 2;
        
        if (user_uid) {
            sql += ` AND te.user_uid = $${++paramCount}`;
            params.push(user_uid);
        }
        
        sql += ` ORDER BY e.full_name, DATE(te.clock_in_timestamp), te.clock_in_timestamp`;
        
        const { rows } = await db.query(sql, params);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "No timesheet data found for the specified period." });
        }

        const csvHeaders = Object.keys(rows[0]).join(',');
        const csvRows = rows.map(row => 
            Object.values(row).map(value => 
                typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(',')
        );
        const csvContent = [csvHeaders, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="detailed_timesheet_${start_date}_to_${end_date}.csv"`);
        res.send(csvContent);
    } catch (err) {
        console.error("Error exporting timesheet:", err);
        res.status(500).json({ error: "Failed to export timesheet." });
    }
});

// FIXED: Labor vs Sales report with consistent column usage
app.get('/api/reports/labor-vs-sales', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, date } = req.query;
        
        let startDate, endDate;
        if (date) {
            startDate = date;
            endDate = date;
        } else if (start_date && end_date) {
            startDate = start_date;
            endDate = end_date;
        } else {
            return res.status(400).json({
                error: "Either date OR start_date and end_date parameters are required"
            });
        }

        console.log(`Generating labor vs sales report for ${startDate} to ${endDate}`);

        // FIXED: Use consistent 'transaction_date' column
        const salesQuery = `
            SELECT 
                DATE(transaction_date) as report_date,
                SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as daily_sales,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as daily_expenses,
                COUNT(CASE WHEN type = 'sale' THEN 1 END) as sale_count
            FROM transactions 
            WHERE DATE(transaction_date) BETWEEN $1 AND $2 
                AND status = 'approved'
            GROUP BY DATE(transaction_date)
            ORDER BY DATE(transaction_date)
        `;

        const laborQuery = `
            SELECT 
                DATE(te.clock_in_timestamp) as report_date,
                COUNT(DISTINCT te.user_uid) as employees_worked,
                COUNT(te.id) as total_shifts,
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                            COALESCE(
                                CASE 
                                    WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                        EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                    ELSE 0
                                END, 0
                            )
                        ELSE 0
                    END
                ), 0) as total_hours,
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            (EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                            COALESCE(
                                CASE 
                                    WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                        EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                    ELSE 0
                                END, 0
                            )) * COALESCE(e.pay_rate, 0)
                        ELSE 0
                    END
                ), 0) as total_labor_cost
            FROM time_entries te
            LEFT JOIN employees e ON te.user_uid = e.uid
            WHERE DATE(te.clock_in_timestamp) BETWEEN $1 AND $2
                AND te.clock_out_time IS NOT NULL
            GROUP BY DATE(te.clock_in_timestamp)
            ORDER BY DATE(te.clock_in_timestamp)
        `;

        // Execute queries with enhanced error handling
        let salesResult, laborResult;
        
        try {
            [salesResult, laborResult] = await Promise.all([
                db.query(salesQuery, [startDate, endDate]),
                db.query(laborQuery, [startDate, endDate])
            ]);
        } catch (dbError) {
            console.error("❌ Database query error:", {
                error: dbError.message,
                query: dbError.query || 'Unknown query'
            });
            return res.status(500).json({ 
                error: "Database query failed. Please check your database schema.",
                details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
            });
        }

        // Process and combine data (existing logic)
        const salesData = salesResult.rows;
        const laborData = laborResult.rows;

        // Create maps for easier lookup
        const laborMap = new Map();
        laborData.forEach(row => {
            laborMap.set(row.report_date.toISOString().split('T')[0], row);
        });

        const salesMap = new Map();
        salesData.forEach(row => {
            salesMap.set(row.report_date.toISOString().split('T')[0], row);
        });

        // Generate complete date range
        const dateRange = [];
        const currentDate = new Date(startDate);
        const endDateObj = new Date(endDate);

        while (currentDate <= endDateObj) {
            dateRange.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Combine data for each date
        const combinedData = dateRange.map(date => {
            const sales = salesMap.get(date) || { 
                daily_sales: 0, 
                daily_expenses: 0, 
                sale_count: 0 
            };
            const labor = laborMap.get(date) || { 
                employees_worked: 0,
                total_shifts: 0,
                total_hours: 0, 
                total_labor_cost: 0 
            };

            const dailySales = parseFloat(sales.daily_sales) || 0;
            const laborCost = parseFloat(labor.total_labor_cost) || 0;
            const laborHours = parseFloat(labor.total_hours) || 0;

            return {
                date: date,
                sales: dailySales,
                expenses: parseFloat(sales.daily_expenses) || 0,
                sale_count: parseInt(sales.sale_count) || 0,
                employees_worked: parseInt(labor.employees_worked) || 0,
                total_shifts: parseInt(labor.total_shifts) || 0,
                labor_hours: laborHours,
                labor_cost: laborCost,
                labor_cost_percentage: dailySales > 0 ? ((laborCost / dailySales) * 100) : 0,
                sales_per_hour: laborHours > 0 ? (dailySales / laborHours) : 0,
                cost_per_hour: laborHours > 0 ? (laborCost / laborHours) : 0
            };
        });

        // Calculate summary statistics
        const summary = {
            total_days: combinedData.length,
            total_sales: combinedData.reduce((sum, day) => sum + day.sales, 0),
            total_expenses: combinedData.reduce((sum, day) => sum + day.expenses, 0),
            total_labor_cost: combinedData.reduce((sum, day) => sum + day.labor_cost, 0),
            total_labor_hours: combinedData.reduce((sum, day) => sum + day.labor_hours, 0),
            average_labor_percentage: 0,
            days_with_sales: combinedData.filter(day => day.sales > 0).length,
            days_with_labor: combinedData.filter(day => day.labor_cost > 0).length
        };

        if (summary.total_sales > 0) {
            summary.average_labor_percentage = (summary.total_labor_cost / summary.total_sales) * 100;
        }

        console.log(`✅ Report generated successfully: ${combinedData.length} days processed`);

        res.json({ 
            data: combinedData,
            summary: summary,
            date_range: { start_date: startDate, end_date: endDate },
            generated_at: new Date().toISOString()
        });

    } catch (err) {
        console.error("❌ Error generating labor vs sales report:", {
            error: err.message,
            stack: err.stack
        });
        res.status(500).json({ 
            error: "Failed to generate labor vs sales report.",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// FIXED: Labor efficiency metrics endpoint
app.get('/api/reports/labor-efficiency', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({
                error: "start_date and end_date are required"
            });
        }

        const sql = `
            SELECT
                DATE(te.clock_in_timestamp) as report_date,
                COUNT(DISTINCT te.user_uid) as employees_scheduled,
                AVG(COALESCE(e.pay_rate, 0)) as average_hourly_rate,
                SUM(
                    CASE
                        WHEN te.clock_out_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600
                        ELSE 0
                    END
                ) as total_scheduled_hours,
                SUM(
                    CASE
                        WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                        ELSE 0
                    END
                ) as total_break_hours,
                -- FIXED: Use consistent column name
                COALESCE((
                    SELECT SUM(amount)
                    FROM transactions
                    WHERE type = 'sale'
                        AND status = 'approved'
                        AND DATE(transaction_date) = DATE(te.clock_in_timestamp)
                ), 0) as daily_sales
            FROM time_entries te
            LEFT JOIN employees e ON te.user_uid = e.uid
            WHERE DATE(te.clock_in_timestamp) BETWEEN $1 AND $2
                AND te.clock_out_time IS NOT NULL
            GROUP BY DATE(te.clock_in_timestamp)
            ORDER BY DATE(te.clock_in_timestamp)
        `;
        
        const { rows } = await db.query(sql, [start_date, end_date]);
        
        const efficiency_data = rows.map(row => ({
            date: row.report_date,
            employees_scheduled: parseInt(row.employees_scheduled),
            average_hourly_rate: parseFloat(row.average_hourly_rate).toFixed(2),
            total_scheduled_hours: parseFloat(row.total_scheduled_hours).toFixed(2),
            total_break_hours: parseFloat(row.total_break_hours).toFixed(2),
            daily_sales: parseFloat(row.daily_sales),
            sales_per_employee: row.employees_scheduled > 0 
                ? (parseFloat(row.daily_sales) / parseInt(row.employees_scheduled)).toFixed(2)
                : 0,
            sales_per_hour: row.total_scheduled_hours > 0 
                ? (parseFloat(row.daily_sales) / parseFloat(row.total_scheduled_hours)).toFixed(2)
                : 0
        }));
        
        res.json({ 
            data: efficiency_data,
            date_range: { start_date, end_date }
        });
    } catch (err) {
        console.error("Error generating labor efficiency report:", err);
        res.status(500).json({ error: "Failed to generate labor efficiency report." });
    }
});


// NEW: Export labor vs sales report as CSV
app.get('/api/reports/labor-vs-sales/export', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, format = 'csv' } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ 
                error: "start_date and end_date are required" 
            });
        }

        // Reuse the main report logic but format for export
        const reportResponse = await fetch(`${req.protocol}://${req.get('host')}/api/reports/labor-vs-sales?start_date=${start_date}&end_date=${end_date}`, {
            headers: { 'Authorization': req.headers.authorization }
        });
        
        if (!reportResponse.ok) {
            throw new Error('Failed to generate report data');
        }
        
        const reportData = await reportResponse.json();
        
        if (format === 'csv') {
            const csvHeaders = 'Date,Sales,Expenses,Labor Hours,Labor Cost,Labor Cost %,Sales per Hour,Cost per Hour\n';
            const csvRows = reportData.data.map(row => 
                `${row.date},${row.sales.toFixed(2)},${row.expenses.toFixed(2)},${row.labor_hours.toFixed(2)},${row.labor_cost.toFixed(2)},${row.labor_cost_percentage.toFixed(2)},${row.sales_per_hour.toFixed(2)},${row.cost_per_hour.toFixed(2)}`
            ).join('\n');
            const csvContent = csvHeaders + csvRows;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="labor_vs_sales_${start_date}_to_${end_date}.csv"`);
            res.send(csvContent);
        } else {
            res.json(reportData);
        }
    } catch (err) {
        console.error("Error exporting labor vs sales report:", err);
        res.status(500).json({ error: "Failed to export report." });
    }
});

// DEBUG: Check transactions table schema
app.get('/api/debug/transactions-schema', adminOnly, async (req, res) => {
    try {
        const sql = `
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            ORDER BY ordinal_position
        `;
        const { rows } = await db.query(sql);
        res.json({ columns: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// =============================================================================
// EMPLOYEE TIMESHEET SUMMARY FOR DASHBOARD - NEW ENDPOINT
// =============================================================================    

// NEW: Employee timesheet summary for dashboard
app.get('/api/reports/timesheet-summary', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ error: "start_date and end_date are required" });
        }

        const sql = `
            SELECT 
                u.uid,
                u.email,
                COALESCE(e.full_name, u.email) as employee_name,
                COALESCE(e.pay_rate, 0) as pay_rate,
                COALESCE(e.job_role, 'Employee') as position,
                -- Calculate total hours with break deductions
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                            COALESCE(
                                CASE 
                                    WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                        EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                    ELSE 0
                                END, 0
                            )
                        ELSE 0
                    END
                ), 0) as total_hours,
                -- Calculate total pay with break deductions
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            (EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600 -
                            COALESCE(
                                CASE 
                                    WHEN te.break_start_time IS NOT NULL AND te.break_end_time IS NOT NULL THEN
                                        EXTRACT(EPOCH FROM (te.break_end_time - te.break_start_time))/3600
                                    ELSE 0
                                END, 0
                            )) * COALESCE(e.pay_rate, 0)
                        ELSE 0
                    END
                ), 0) as total_pay
            FROM users u
            LEFT JOIN employees e ON u.uid = e.uid
            LEFT JOIN time_entries te ON u.uid = te.user_uid 
                AND te.clock_in_timestamp >= $1::date 
                AND te.clock_in_timestamp < $2::date + INTERVAL '1 day'
            WHERE u.role != 'primary_admin'
            GROUP BY u.uid, u.email, e.full_name, e.pay_rate, e.job_role
            HAVING COUNT(te.id) > 0
            ORDER BY e.full_name, u.email
        `;
        
        const { rows } = await db.query(sql, [start_date, end_date]);
        
        // Calculate totals
        const totals = {
            total_employees: rows.length,
            total_hours: rows.reduce((sum, row) => sum + parseFloat(row.total_hours || 0), 0),
            total_payroll: rows.reduce((sum, row) => sum + parseFloat(row.total_pay || 0), 0)
        };
        
        res.json({ 
            employees: rows,
            totals: totals,
            date_range: { start_date, end_date }
        });
    } catch (err) {
        console.error("Timesheet summary error:", err);
        res.status(500).json({ error: "Failed to generate timesheet summary" });
    }
});

// =============================================================================
// ROTA MANAGEMENT API - UPDATED AND FIXED
// =============================================================================

// Get shift templates - FIXED: Added authentication
app.get('/api/shift-templates', authMiddleware, async (req, res) => {
    try {
        const { position } = req.query;
        
        let sql = 'SELECT * FROM shift_templates';
        let params = [];
        
        if (position) {
            sql += ' WHERE position_required = $1';
            params.push(position);
        }
        
        sql += ' ORDER BY name';
        
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching shift templates:', err);
        res.status(500).json({ error: 'Failed to fetch shift templates' });
    }
});

// Create shift template
app.post('/api/shift-templates', adminOnly, validateShiftTemplate, async (req, res) => {
    const { name, start_time, duration_minutes, position_required, max_employees = 1, break_duration_minutes = 30 } = req.body;
    
    try {
        const sql = `
            INSERT INTO shift_templates 
            (name, start_time, duration_minutes, position_required, max_employees, break_duration_minutes) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING *
        `;
        const { rows } = await db.query(sql, [
            name.trim(), 
            start_time, 
            parseInt(duration_minutes), 
            position_required || null, 
            parseInt(max_employees), 
            parseInt(break_duration_minutes)
        ]);
        
        await logActivity(req.user, 'CREATE_SHIFT_TEMPLATE', `Created template: ${name.trim()}`, req);
        res.status(201).json({ data: rows[0] });
    } catch (err) {
        console.error('Error creating shift template:', err);
        if (err.code === '23505') {
            res.status(400).json({ error: 'A shift template with this name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create shift template' });
        }
    }
});

// Update shift template
app.put('/api/shift-templates/:id', validateId, adminOnly, validateShiftTemplate, async (req, res) => {
    const templateId = req.params.id;
    const { name, start_time, duration_minutes, position_required, max_employees, break_duration_minutes } = req.body;
    
    try {
        const checkSql = 'SELECT * FROM shift_templates WHERE id = $1';
        const checkResult = await db.query(checkSql, [templateId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shift template not found' });
        }
        
        const sql = `
            UPDATE shift_templates 
            SET name = $1, start_time = $2, duration_minutes = $3, position_required = $4, 
                max_employees = $5, break_duration_minutes = $6 
            WHERE id = $7 
            RETURNING *
        `;
        const { rows } = await db.query(sql, [
            name.trim(), 
            start_time, 
            parseInt(duration_minutes), 
            position_required || null, 
            parseInt(max_employees || 1), 
            parseInt(break_duration_minutes || 30), 
            templateId
        ]);
        
        await logActivity(req.user, 'UPDATE_SHIFT_TEMPLATE', `Updated template: ${name.trim()}`, req);
        res.json({ data: rows[0] });
    } catch (err) {
        console.error('Error updating shift template:', err);
        if (err.code === '23505') {
            res.status(400).json({ error: 'A shift template with this name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to update shift template' });
        }
    }
});

// Delete shift template
app.delete('/api/shift-templates/:id', validateId, adminOnly, async (req, res) => {
    const templateId = req.params.id;
    
    try {
        const checkSql = 'SELECT * FROM shift_templates WHERE id = $1';
        const checkResult = await db.query(checkSql, [templateId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Shift template not found' });
        }
        
        const usageSql = 'SELECT COUNT(*) as usage_count FROM rota_shifts WHERE shift_template_id = $1';
        const usageResult = await db.query(usageSql, [templateId]);
        const usageCount = parseInt(usageResult.rows[0].usage_count);
        
        if (usageCount > 0) {
            return res.status(400).json({ 
                error: `Cannot delete template. It is currently used in ${usageCount} scheduled shift(s).` 
            });
        }
        
        const deleteSql = 'DELETE FROM shift_templates WHERE id = $1 RETURNING *';
        const { rows } = await db.query(deleteSql, [templateId]);
        
        await logActivity(req.user, 'DELETE_SHIFT_TEMPLATE', `Deleted template: ${rows[0].name}`, req);
        res.json({ message: 'Shift template deleted successfully' });
    } catch (err) {
        console.error('Error deleting shift template:', err);
        res.status(500).json({ error: 'Failed to delete shift template' });
    }
});

// Get rota shifts - FIXED: Column name consistency
app.get('/api/rota', authMiddleware, async (req, res) => {
    try {
        const { start_date, end_date, week_start, user_uid } = req.query;
        let startDate, endDate;

        if (week_start) {
            startDate = week_start;
            const end = new Date(week_start);
            end.setDate(end.getDate() + 6);
            endDate = end.toISOString().split('T')[0];
        } else if (start_date && end_date) {
            startDate = start_date;
            endDate = end_date;
        } else {
            return res.status(400).json({ 
                error: "Either week_start OR start_date and end_date parameters are required" 
            });
        }

        let sql = `
            SELECT 
                rs.*,
                st.name as shift_name,
                st.start_time,
                st.duration_minutes,
                u.email, 
                COALESCE(e.full_name, u.email) as full_name,
                COALESCE(e.job_role, 'Staff') as position,
                CASE 
                    WHEN rs.custom_start_time IS NOT NULL THEN rs.custom_start_time
                    ELSE st.start_time
                END as actual_start_time,
                CASE 
                    WHEN rs.custom_end_time IS NOT NULL THEN rs.custom_end_time
                    ELSE (st.start_time::time + (st.duration_minutes || ' minutes')::interval)::time
                END as actual_end_time
            FROM rota_shifts rs
            LEFT JOIN shift_templates st ON rs.shift_template_id = st.id
            JOIN users u ON rs.user_uid = u.uid
            LEFT JOIN employees e ON rs.user_uid = e.uid
            WHERE rs.shift_date >= $1 AND rs.shift_date <= $2
        `;

        let params = [startDate, endDate];
        let paramCount = 2;

        if (user_uid) {
            sql += ` AND rs.user_uid = $${++paramCount}`;
            params.push(user_uid);
        }

        sql += ` ORDER BY rs.shift_date, rs.custom_start_time, st.start_time, e.full_name`;

        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching rota:", err);
        res.status(500).json({ error: "Failed to fetch rota." });
    }
});

// Create rota shift - FIXED: Enhanced validation and error handling
app.post('/api/rota', adminOnly, async (req, res) => {
    console.log('Received payload:', req.body);

    const {
        user_uid,
        shift_template_id,
        shift_date,
        custom_start_time,
        custom_end_time,
        notes
    } = req.body;

    // Enhanced validation
    if (!user_uid || !shift_date) {
        return res.status(400).json({
            error: "User UID and shift date are required."
        });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shift_date)) {
        return res.status(400).json({
            error: "Shift date must be in YYYY-MM-DD format."
        });
    }

    // Require either template ID OR both custom times
    if (!shift_template_id && (!custom_start_time || !custom_end_time)) {
        return res.status(400).json({
            error: "Either shift template ID or both custom start/end times are required."
        });
    }

    // Validate custom times format if provided
    if (custom_start_time && !/^\d{2}:\d{2}$/.test(custom_start_time)) {
        return res.status(400).json({
            error: "Custom start time must be in HH:MM format."
        });
    }

    if (custom_end_time && !/^\d{2}:\d{2}$/.test(custom_end_time)) {
        return res.status(400).json({
            error: "Custom end time must be in HH:MM format."
        });
    }

    try {
        // Verify user exists and is active
        const userSql = 'SELECT * FROM users WHERE uid = $1 AND status = $2';
        const userResult = await db.query(userSql, [user_uid, 'active']);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found or inactive." });
        }
        
        const user = userResult.rows[0];

        // Validate template if provided
        let template = null;
        if (shift_template_id) {
            const templateSql = 'SELECT * FROM shift_templates WHERE id = $1';
            const templateResult = await db.query(templateSql, [shift_template_id]);

            if (templateResult.rows.length === 0) {
                return res.status(404).json({ error: "Shift template not found." });
            }
            template = templateResult.rows[0];
        }

        // Check for overlapping shifts (optional - remove if multiple shifts per day are allowed)
        const overlapSql = `
            SELECT COUNT(*) as overlap_count
            FROM rota_shifts rs
            LEFT JOIN shift_templates st ON rs.shift_template_id = st.id
            WHERE rs.user_uid = $1 
                AND rs.shift_date = $2
                AND (
                    (rs.custom_start_time IS NOT NULL AND rs.custom_end_time IS NOT NULL) OR
                    (st.start_time IS NOT NULL AND st.duration_minutes IS NOT NULL)
                )
        `;
        const overlapResult = await db.query(overlapSql, [user_uid, shift_date]);
        
        // Uncomment below if you want to prevent multiple shifts per day
        // if (parseInt(overlapResult.rows[0].overlap_count) > 0) {
        //     return res.status(400).json({ 
        //         error: "User already has a shift scheduled for this date." 
        //     });
        // }

        // Insert shift
        const sql = `
            INSERT INTO rota_shifts
            (user_uid, shift_template_id, shift_date, custom_start_time, custom_end_time, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        
        const { rows } = await db.query(sql, [
            user_uid,
            shift_template_id || null,
            shift_date,
            custom_start_time || null,
            custom_end_time || null,
            notes || null,
            req.user.uid
        ]);

        console.log('Created shift:', rows[0]);

        // Enhanced activity logging
        const shiftDesc = custom_start_time 
            ? `Custom shift ${custom_start_time}-${custom_end_time}` 
            : `Template shift: ${template?.name || 'Unknown'}`;
        
        await logActivity(req.user, 'CREATE_ROTA_SHIFT',
            `Assigned ${shiftDesc} to ${user.email} for ${shift_date}`, req);

        res.status(201).json({ 
            message: "Shift assigned successfully",
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error creating rota shift:", err);
        res.status(500).json({ error: "Failed to create rota shift." });
    }
});

// Delete rota shift - FIXED: Enhanced logging
app.delete('/api/rota/:id', adminOnly, async (req, res) => {
    const shiftId = req.params.id;
    
    try {
        // Validate shift ID
        if (!shiftId || isNaN(shiftId)) {
            return res.status(400).json({ error: "Invalid shift ID." });
        }

        // Get shift details for logging
        const selectSql = `
            SELECT rs.*, st.name as template_name, u.email as user_email
            FROM rota_shifts rs
            LEFT JOIN shift_templates st ON rs.shift_template_id = st.id
            LEFT JOIN users u ON rs.user_uid = u.uid
            WHERE rs.id = $1
        `;
        const selectResult = await db.query(selectSql, [shiftId]);
        
        if (selectResult.rows.length === 0) {
            return res.status(404).json({ error: "Shift not found." });
        }

        const shift = selectResult.rows[0];
        
        // Delete the shift
        const deleteSql = 'DELETE FROM rota_shifts WHERE id = $1 RETURNING *';
        const { rows } = await db.query(deleteSql, [shiftId]);

        // Enhanced activity logging
        const shiftDesc = shift.custom_start_time 
            ? `Custom shift ${shift.custom_start_time}-${shift.custom_end_time}` 
            : `Template shift: ${shift.template_name || 'Unknown'}`;
        
        await logActivity(req.user, 'DELETE_ROTA_SHIFT', 
            `Deleted ${shiftDesc} for ${shift.user_email} on ${shift.shift_date}`, req);

        res.json({ 
            message: "Shift deleted successfully", 
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error deleting shift:", err);
        res.status(500).json({ error: "Failed to delete shift." });
    }
});

// Publish rota - FIXED: Enhanced validation and notifications
app.post('/api/rota/publish', adminOnly, async (req, res) => {
    const { week_start } = req.body;

    if (!week_start) {
        return res.status(400).json({ 
            error: "week_start is required (YYYY-MM-DD format)" 
        });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
        return res.status(400).json({
            error: "week_start must be in YYYY-MM-DD format."
        });
    }

    try {
        // Check if there are any shifts to publish
        const checkSql = `
            SELECT COUNT(*) as shift_count
            FROM rota_shifts 
            WHERE shift_date >= $1 
                AND shift_date < $1::date + INTERVAL '7 days'
                AND published = false
        `;
        const checkResult = await db.query(checkSql, [week_start]);
        
        if (parseInt(checkResult.rows[0].shift_count) === 0) {
            return res.status(400).json({ 
                error: "No unpublished shifts found for the specified week." 
            });
        }

        // Publish shifts
        const sql = `
            UPDATE rota_shifts 
            SET published = true, published_at = NOW(), published_by = $1
            WHERE shift_date >= $2 
                AND shift_date < $2::date + INTERVAL '7 days'
                AND published = false
            RETURNING *
        `;
        
        const { rows } = await db.query(sql, [req.user.uid, week_start]);

        await logActivity(req.user, 'PUBLISH_ROTA', 
            `Published rota for week starting ${week_start} (${rows.length} shifts)`, req);

        // Notify all affected employees
        const affectedEmployees = [...new Set(rows.map(shift => shift.user_uid))];
        for (const employeeUid of affectedEmployees) {
            try {
                await createNotification(
                    employeeUid,
                    'Rota Published',
                    `The rota for week starting ${week_start} has been published`,
                    'info',
                    '/my-schedule'
                );
            } catch (notificationError) {
                console.error('Failed to send notification:', notificationError);
                // Don't fail the entire operation if notifications fail
            }
        }

        res.json({ 
            message: `Rota published successfully for week starting ${week_start}`, 
            data: { 
                published_shifts: rows.length, 
                shifts: rows,
                affected_employees: affectedEmployees.length
            } 
        });
    } catch (err) {
        console.error("Error publishing rota:", err);
        res.status(500).json({ error: "Failed to publish rota." });
    }
});

// NEW: Get rota statistics
app.get('/api/rota/stats', adminOnly, async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        if (!start_date || !end_date) {
            return res.status(400).json({ 
                error: "start_date and end_date are required" 
            });
        }

        const sql = `
            SELECT 
                COUNT(*) as total_shifts,
                COUNT(DISTINCT user_uid) as employees_scheduled,
                COUNT(CASE WHEN published = true THEN 1 END) as published_shifts,
                COUNT(CASE WHEN published = false THEN 1 END) as unpublished_shifts,
                COUNT(CASE WHEN custom_start_time IS NOT NULL THEN 1 END) as custom_shifts,
                COUNT(CASE WHEN shift_template_id IS NOT NULL THEN 1 END) as template_shifts
            FROM rota_shifts
            WHERE shift_date >= $1 AND shift_date <= $2
        `;
        
        const { rows } = await db.query(sql, [start_date, end_date]);
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Error fetching rota statistics:", err);
        res.status(500).json({ error: "Failed to fetch rota statistics." });
    }
});

// =============================================================================
// ADVANCED ROTA FEATURES - NEW ROUTES
// =============================================================================

// Copy previous week template
app.post('/api/rota/copy-previous-week', adminOnly, async (req, res) => {
    try {
        const { target_week_start, source_week_start, overwrite_conflicts = true } = req.body;
        
        if (!target_week_start) {
            return res.status(400).json({ 
                error: "target_week_start is required (YYYY-MM-DD format)" 
            });
        }

        // If no source week specified, use previous week
        let sourceWeek = source_week_start;
        if (!sourceWeek) {
            const targetDate = new Date(target_week_start);
            targetDate.setDate(targetDate.getDate() - 7);
            sourceWeek = targetDate.toISOString().split('T')[0];
        }

        console.log(`Copying rota from ${sourceWeek} to ${target_week_start}`);

        // Get shifts from source week
        const sourceShiftsSql = `
            SELECT 
                user_uid,
                shift_template_id,
                custom_start_time,
                custom_end_time,
                notes,
                EXTRACT(DOW FROM shift_date) as day_of_week
            FROM rota_shifts 
            WHERE shift_date >= $1::date 
                AND shift_date < $1::date + INTERVAL '7 days'
            ORDER BY shift_date, custom_start_time
        `;
        const sourceResult = await db.query(sourceShiftsSql, [sourceWeek]);

        if (sourceResult.rows.length === 0) {
            return res.status(404).json({ 
                error: "No shifts found in source week to copy" 
            });
        }

        // Handle conflicts if overwrite is false
        if (!overwrite_conflicts) {
            const conflictSql = `
                SELECT COUNT(*) as conflict_count
                FROM rota_shifts 
                WHERE shift_date >= $1::date 
                    AND shift_date < $1::date + INTERVAL '7 days'
            `;
            const conflictResult = await db.query(conflictSql, [target_week_start]);
            
            if (parseInt(conflictResult.rows[0].conflict_count) > 0) {
                return res.status(400).json({ 
                    error: "Target week has existing shifts. Set overwrite_conflicts to true to replace them." 
                });
            }
        }

        // Clear existing shifts in target week if overwriting
        if (overwrite_conflicts) {
            await db.query(`
                DELETE FROM rota_shifts 
                WHERE shift_date >= $1::date 
                    AND shift_date < $1::date + INTERVAL '7 days'
            `, [target_week_start]);
        }

        // Copy shifts to target week
        const copiedShifts = [];
        for (const shift of sourceResult.rows) {
            const targetDate = new Date(target_week_start);
            targetDate.setDate(targetDate.getDate() + parseInt(shift.day_of_week));
            
            const insertSql = `
                INSERT INTO rota_shifts 
                (user_uid, shift_template_id, shift_date, custom_start_time, custom_end_time, notes, created_by, published)
                VALUES ($1, $2, $3, $4, $5, $6, $7, false)
                RETURNING *
            `;
            
            const { rows } = await db.query(insertSql, [
                shift.user_uid,
                shift.shift_template_id,
                targetDate.toISOString().split('T')[0],
                shift.custom_start_time,
                shift.custom_end_time,
                shift.notes,
                req.user.uid
            ]);
            
            copiedShifts.push(rows[0]);
        }

        await logActivity(req.user, 'COPY_PREVIOUS_WEEK', 
            `Copied ${copiedShifts.length} shifts from ${sourceWeek} to ${target_week_start}`, req);

        res.json({
            message: `Successfully copied ${copiedShifts.length} shifts`,
            data: {
                copied_shifts: copiedShifts.length,
                source_week: sourceWeek,
                target_week: target_week_start,
                shifts: copiedShifts
            }
        });
    } catch (err) {
        console.error("Error copying previous week:", err);
        res.status(500).json({ error: "Failed to copy previous week template" });
    }
});



// Smart shift assignment route - FIXED without transaction dependency
app.post('/api/rota/smart-assign', adminOnly, async (req, res) => {
    try {
        const { 
            week_start, 
            consider_events = false, 
            events = [], 
            max_labor_cost_percentage = 25,
            priority_factors = {
                availability: 0.4,
                cost: 0.3,
                experience: 0.2,
                fairness: 0.1
            }
        } = req.body;
        
        console.log('Smart assign request:', { week_start, consider_events, events });
        
        if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
            return res.status(400).json({
                error: "week_start is required in YYYY-MM-DD format"
            });
        }

        // Clear existing shifts for the week
        const clearSql = `
            DELETE FROM rota_shifts 
            WHERE shift_date >= $1::date 
                AND shift_date < $1::date + INTERVAL '7 days'
        `;
        await db.query(clearSql, [week_start]);

        // Get available employees
        const employeesSql = `
            SELECT 
                u.uid, u.email,
                COALESCE(e.full_name, u.email) as full_name,
                COALESCE(e.pay_rate, 10.50) as pay_rate,
                COALESCE(e.job_role, 'Staff') as job_role,
                COALESCE(SUM(
                    CASE 
                        WHEN te.clock_out_time IS NOT NULL THEN
                            EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_timestamp))/3600
                        ELSE 0
                    END
                ), 0) as recent_hours
            FROM users u
            LEFT JOIN employees e ON u.uid = e.uid
            LEFT JOIN time_entries te ON u.uid = te.user_uid 
                AND te.clock_in_timestamp >= CURRENT_DATE - INTERVAL '4 weeks'
            WHERE u.status = 'active' AND u.role != 'primary_admin'
            GROUP BY u.uid, u.email, e.full_name, e.pay_rate, e.job_role
            ORDER BY e.pay_rate, recent_hours
        `;
        const employees = await db.query(employeesSql);

        // Get shift templates
        const templatesSql = `SELECT * FROM shift_templates ORDER BY start_time`;
        const templates = await db.query(templatesSql);

        if (employees.rows.length === 0 || templates.rows.length === 0) {
            return res.status(400).json({ 
                error: "No active employees or shift templates found for assignment" 
            });
        }

        // Use predefined sales patterns instead of database query
        const defaultSalesPatterns = {
            0: 150, // Sunday
            1: 180, // Monday  
            2: 200, // Tuesday
            3: 220, // Wednesday
            4: 250, // Thursday
            5: 300, // Friday
            6: 280  // Saturday
        };

        // Generate assignments for the week
        const assignments = [];
        const weekDays = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(week_start);
            date.setDate(date.getDate() + i);
            return date;
        });

        for (const date of weekDays) {
            const dayOfWeek = date.getDay();
            const dateStr = date.toISOString().split('T')[0];
            
            // Calculate staffing needs
            const baseSales = defaultSalesPatterns[dayOfWeek] || 200;
            const hasEvent = consider_events && events.some(event => event.date === dateStr);
            const eventMultiplier = hasEvent ? 1.5 : 1.0;
            const predictedSales = baseSales * eventMultiplier;
            const staffingLevel = Math.max(1, Math.ceil(predictedSales / 200));

            // Assign shifts
            const dailyAssignments = Math.min(staffingLevel, employees.rows.length, templates.rows.length);
            
            for (let i = 0; i < dailyAssignments; i++) {
                const template = templates.rows[i % templates.rows.length];
                
                // Score employees for optimal assignment
                const scoredEmployees = employees.rows.map(emp => {
                    const costScore = 1.0 - (parseFloat(emp.pay_rate) / 20.0);
                    const fairnessScore = 1.0 - (parseFloat(emp.recent_hours) / 160.0);
                    const experienceScore = emp.job_role === template.position_required ? 1.0 : 0.8;
                    
                    const totalScore = 
                        (costScore * priority_factors.cost) +
                        (fairnessScore * priority_factors.fairness) +
                        (experienceScore * priority_factors.experience) +
                        (0.8 * priority_factors.availability);
                    
                    return { ...emp, score: totalScore };
                }).sort((a, b) => b.score - a.score);

                // Find available employee (avoid double-booking)
                const availableEmployee = scoredEmployees.find(emp => 
                    !assignments.some(assignment => 
                        assignment.user_uid === emp.uid && assignment.shift_date === dateStr
                    )
                );

                if (availableEmployee) {
                    assignments.push({
                        user_uid: availableEmployee.uid,
                        shift_template_id: template.id,
                        shift_date: dateStr,
                        predicted_sales: predictedSales,
                        has_event: hasEvent,
                        assignment_score: availableEmployee.score
                    });
                }
            }
        }

        // Insert assignments into database
        const insertedShifts = [];
        for (const assignment of assignments) {
            const insertSql = `
                INSERT INTO rota_shifts 
                (user_uid, shift_template_id, shift_date, created_by, published, notes)
                VALUES ($1, $2, $3, $4, false, $5)
                RETURNING *
            `;
            
            const notes = `Smart assigned - Score: ${assignment.assignment_score.toFixed(2)}${assignment.has_event ? ' (Event day)' : ''}`;
            
            const { rows } = await db.query(insertSql, [
                assignment.user_uid,
                assignment.shift_template_id,
                assignment.shift_date,
                req.user.uid,
                notes
            ]);
            
            insertedShifts.push(rows[0]);
        }

        // Log activity
        try {
            await logActivity(req.user, 'SMART_ASSIGN_SHIFTS', 
                `Smart assigned ${insertedShifts.length} shifts for week ${week_start}`, req);
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }

        console.log(`✅ Smart assignment completed: ${insertedShifts.length} shifts assigned`);

        res.json({
            message: `Successfully assigned ${insertedShifts.length} shifts using smart algorithm`,
            data: {
                assigned_shifts: insertedShifts.length,
                week_start: week_start,
                assignments: assignments,
                shifts: insertedShifts
            }
        });
    } catch (err) {
        console.error("❌ Error in smart assignment:", {
            error: err.message,
            stack: err.stack,
            user: req.user?.uid
        });
        res.status(500).json({ 
            error: "Failed to perform smart shift assignment",
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});


// Get events/matches for a specific week
app.get('/api/rota/events', adminOnly, async (req, res) => {
    try {
        const { week_start } = req.query;
        
        if (!week_start) {
            return res.status(400).json({ 
                error: "week_start is required" 
            });
        }

        // This would integrate with external APIs or your events database
        // For now, returning mock data structure
        const mockEvents = [
            {
                date: week_start,
                type: 'football_match',
                name: 'Local Derby Match',
                expected_impact: 'high',
                estimated_sales_multiplier: 1.8
            }
        ];

        res.json({
            data: mockEvents,
            week_start: week_start
        });
    } catch (err) {
        console.error("Error fetching events:", err);
        res.status(500).json({ error: "Failed to fetch events data" });
    }
});


// =============================================================================
// TIME ENTRIES ADMIN API
// =============================================================================

app.get('/api/time-entries', async (req, res) => {
    try {
        const { start_date, end_date, user_uid, status, limit = 100, offset = 0 } = req.query;
        
        let sql = `
            SELECT te.*, u.email, COALESCE(e.full_name, u.email) as full_name,
                   COALESCE(e.position, 'Staff') as position,
                   EXTRACT(EPOCH FROM (te.clock_out_time - te.clock_in_time))/3600 as hours_worked
            FROM time_entries te
            JOIN users u ON te.user_uid = u.uid
            LEFT JOIN employees e ON te.user_uid = e.uid
            WHERE 1=1
        `;
        let params = [];
        let paramCount = 0;
        
        if (start_date) {
            sql += ` AND DATE(te.clock_in_time) >= $${++paramCount}`;
            params.push(start_date);
        }
        
        if (end_date) {
            sql += ` AND DATE(te.clock_in_time) <= $${++paramCount}`;
            params.push(end_date);
        }
        
        if (user_uid) {
            sql += ` AND te.user_uid = $${++paramCount}`;
            params.push(user_uid);
        }
        
        if (status) {
            sql += ` AND te.status = $${++paramCount}`;
            params.push(status);
        }
        
        sql += ` ORDER BY te.clock_in_time DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const { rows } = await db.query(sql, params);
        
        let countSql = `
            SELECT COUNT(*) as total
            FROM time_entries te
            WHERE 1=1
        `;
        let countParams = [];
        let countParamCount = 0;
        
        if (start_date) {
            countSql += ` AND DATE(te.clock_in_time) >= $${++countParamCount}`;
            countParams.push(start_date);
        }
        
        if (end_date) {
            countSql += ` AND DATE(te.clock_in_time) <= $${++countParamCount}`;
            countParams.push(end_date);
        }
        
        if (user_uid) {
            countSql += ` AND te.user_uid = $${++countParamCount}`;
            countParams.push(user_uid);
        }
        
        if (status) {
            countSql += ` AND te.status = $${++countParamCount}`;
            countParams.push(status);
        }
        
        const countResult = await db.query(countSql, countParams);
        
        res.json({
            data: rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
            }
        });
    } catch (err) {
        console.error("Error fetching time entries:", err);
        res.status(500).json({ error: "Failed to fetch time entries." });
    }
});

app.put('/api/time-entries/:id', validateId, adminOnly, async (req, res) => {
    const entryId = req.params.id;
    const { clock_in_time, clock_out_time, notes, status = 'approved' } = req.body;

    try {
        const checkSql = 'SELECT * FROM time_entries WHERE id = $1';
        const checkResult = await db.query(checkSql, [entryId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Time entry not found." });
        }

        const updateSql = `
            UPDATE time_entries 
            SET clock_in_time = $1, clock_out_time = $2, notes = $3, status = $4,
                total_hours = CASE 
                    WHEN $2 IS NOT NULL THEN EXTRACT(EPOCH FROM ($2::timestamptz - $1::timestamptz))/3600
                    ELSE NULL 
                END
            WHERE id = $5 
            RETURNING *
        `;
        const { rows } = await db.query(updateSql, [clock_in_time, clock_out_time || null, notes || null, status, entryId]);

        await logActivity(req.user, 'UPDATE_TIME_ENTRY', `Updated time entry for ${checkResult.rows[0].user_email}`);

        res.json({ 
            message: "Time entry updated successfully", 
            data: rows[0] 
        });
    } catch (err) {
        console.error("Error updating time entry:", err);
        res.status(500).json({ error: "Failed to update time entry." });
    }
});

app.delete('/api/time-entries/:id', validateId, adminOnly, async (req, res) => {
    const entryId = req.params.id;

    try {
        const checkSql = 'SELECT * FROM time_entries WHERE id = $1';
        const checkResult = await db.query(checkSql, [entryId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: "Time entry not found." });
        }

        const deleteSql = 'DELETE FROM time_entries WHERE id = $1 RETURNING *';
        const { rows } = await db.query(deleteSql, [entryId]);

        await logActivity(req.user, 'DELETE_TIME_ENTRY', `Deleted time entry for ${checkResult.rows[0].user_email}`);

        res.json({ message: "Time entry deleted successfully", data: rows[0] });
    } catch (err) {
        console.error("Error deleting time entry:", err);
        res.status(500).json({ error: "Failed to delete time entry." });
    }
});

// =============================================================================
// ACTIVITY LOGS API
// =============================================================================

app.get('/api/activity-logs', async (req, res) => {
    try {
        const { limit = 100, offset = 0, action_type, user_uid, start_date, end_date } = req.query;
        
        let sql = `
            SELECT al.*, u.email, COALESCE(e.full_name, u.email) as user_name
            FROM activity_logs al
            LEFT JOIN users u ON al.user_uid = u.uid
            LEFT JOIN employees e ON al.user_uid = e.uid
            WHERE 1=1
        `;
        let params = [];
        let paramCount = 0;
        
        if (action_type) {
            sql += ` AND al.action_type = $${++paramCount}`;
            params.push(action_type);
        }
        
        if (user_uid) {
            sql += ` AND al.user_uid = $${++paramCount}`;
            params.push(user_uid);
        }
        
        if (start_date) {
            sql += ` AND DATE(al.timestamp) >= $${++paramCount}`;
            params.push(start_date);
        }
        
        if (end_date) {
            sql += ` AND DATE(al.timestamp) <= $${++paramCount}`;
            params.push(end_date);
        }
        
        sql += ` ORDER BY al.timestamp DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(parseInt(limit), parseInt(offset));
        
        const { rows } = await db.query(sql, params);
        
        let countSql = `SELECT COUNT(*) as total FROM activity_logs WHERE 1=1`;
        let countParams = [];
        let countParamCount = 0;
        
        if (action_type) {
            countSql += ` AND action_type = $${++countParamCount}`;
            countParams.push(action_type);
        }
        
        if (user_uid) {
            countSql += ` AND user_uid = $${++countParamCount}`;
            countParams.push(user_uid);
        }
        
        if (start_date) {
            countSql += ` AND DATE(timestamp) >= $${++countParamCount}`;
            countParams.push(start_date);
        }
        
        if (end_date) {
            countSql += ` AND DATE(timestamp) <= $${++countParamCount}`;
            countParams.push(end_date);
        }
        
        const countResult = await db.query(countSql, countParams);
        
        res.json({
            data: rows,
            pagination: {
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
            }
        });
    } catch (err) {
        console.error("Error fetching activity logs:", err);
        res.status(500).json({ error: "Failed to fetch activity logs." });
    }
});

// =============================================================================
// NOTIFICATIONS API
// =============================================================================

app.get('/api/notifications', async (req, res) => {
    try {
        const { is_read, limit = 50, offset = 0 } = req.query;
        
        let sql = `
            SELECT * FROM notifications 
            WHERE user_uid = $1 
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        let params = [req.user.uid];
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
        console.error("Error fetching notifications:", err);
        res.status(500).json({ error: "Failed to fetch notifications." });
    }
});

app.put('/api/notifications/:id/read', validateId, async (req, res) => {
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
            return res.status(404).json({ error: "Notification not found." });
        }
        
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Error marking notification as read:", err);
        res.status(500).json({ error: "Failed to mark notification as read." });
    }
});

app.put('/api/notifications/mark-all-read', async (req, res) => {
    try {
        const sql = `
            UPDATE notifications 
            SET is_read = true 
            WHERE user_uid = $1 AND is_read = false
            RETURNING COUNT(*) as updated_count
        `;
        const { rows } = await db.query(sql, [req.user.uid]);
        
        res.json({ message: "All notifications marked as read", count: rows.length });
    } catch (err) {
        console.error("Error marking all notifications as read:", err);
        res.status(500).json({ error: "Failed to mark all notifications as read." });
    }
});

app.delete('/api/notifications/:id', validateId, async (req, res) => {
    const notificationId = req.params.id;

    try {
        const sql = `
            DELETE FROM notifications 
            WHERE id = $1 AND user_uid = $2 
            RETURNING *
        `;
        const { rows } = await db.query(sql, [notificationId, req.user.uid]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "Notification not found." });
        }
        
        res.json({ message: "Notification deleted successfully" });
    } catch (err) {
        console.error("Error deleting notification:", err);
        res.status(500).json({ error: "Failed to delete notification." });
    }
});

// =============================================================================
// SETTINGS API
// =============================================================================

app.get('/api/settings', async (req, res) => {
    try {
        const { category, is_public } = req.query;
        
        let sql = 'SELECT * FROM settings WHERE 1=1';
        let params = [];
        let paramCount = 0;
        
        if (category) {
            sql += ` AND category = $${++paramCount}`;
            params.push(category);
        }
        
        if (is_public !== undefined) {
            sql += ` AND is_public = $${++paramCount}`;
            params.push(is_public === 'true');
        }
        
        sql += ' ORDER BY category, key';
        
        const { rows } = await db.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error("Error fetching settings:", err);
        res.status(500).json({ error: "Failed to fetch settings." });
    }
});

app.put('/api/settings/:key', adminOnly, async (req, res) => {
    const settingKey = req.params.key;
    const { value, description } = req.body;

    try {
        const sql = `
            UPDATE settings 
            SET value = $1, description = COALESCE($2, description), updated_by = $3, updated_at = NOW()
            WHERE key = $4 
            RETURNING *
        `;
        const { rows } = await db.query(sql, [value, description, req.user.uid, settingKey]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: "Setting not found." });
        }
        
        await logActivity(req.user, 'UPDATE_SETTING', `Updated setting: ${settingKey} = ${value}`);
        
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Error updating setting:", err);
        res.status(500).json({ error: "Failed to update setting." });
    }
});

// =============================================================================
// FILE UPLOAD API
// =============================================================================

app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        await logActivity(req.user, 'FILE_UPLOAD', `Uploaded file: ${req.file.originalname}`);

        res.json({
            message: 'File uploaded successfully',
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                url: `/uploads/${req.file.filename}`
            }
        });
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use('/api/*catchall', (req, res) => {
    res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.originalUrl,
        method: req.method
    });
});

app.use('*catchall', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        message: 'This server only handles API requests. Please check your endpoint.'
    });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

const startServer = async () => {
    try {
        await db.query('SELECT NOW()');
        console.log('✅ Database connection established');
        
        server.listen(PORT, () => {
            console.log('🚀 Server started successfully!');
            console.log(`📍 Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔐 API base URL: http://localhost:${PORT}/api`);
            console.log(`🔄 Real-time analytics enabled`);
            console.log(`📁 File uploads: /uploads directory`);
            console.log(`🔔 Real-time notifications enabled`);
            console.log('⏰ Server started at:', new Date().toISOString());
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Enhanced error handling to prevent server crashes
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        user: req.user?.uid || 'anonymous'
    });
    
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;
        
    res.status(err.status || 500).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            details: err.code || 'Unknown error code'
        })
    });
});


// Add at the end of your routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.stack);
  process.exit(1);
});


startServer();

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
    
    if (db.pool) {
        db.pool.end(() => {
            console.log('🔌 Database connections closed');
        });
    }
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;

