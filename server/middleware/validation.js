// server/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

// Transaction validation rules
const validateTransaction = [
    body('description')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('Description must be between 2 and 255 characters')
        .escape(), // Prevent XSS
    body('amount')
        .isFloat({ min: 0.01, max: 999999.99 })
        .withMessage('Amount must be between 0.01 and 999,999.99'),
    body('type')
        .isIn(['sale', 'expense'])
        .withMessage('Type must be either sale or expense'),
    body('category')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Category must not exceed 100 characters')
        .escape(),
    body('transaction_date')
        .optional()
        .isISO8601()
        .withMessage('Transaction date must be a valid date'),
    body('reason')
        .optional()
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage('Reason must be between 3 and 500 characters')
        .escape(),
    validateRequest
];

// User validation rules
const validateUser = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('role')
        .isIn(['staff', 'secondary_admin'])
        .withMessage('Role must be staff or secondary_admin'),
    validateRequest
];

// Employee validation rules
const validateEmployee = [
    body('full_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Full name must be between 2 and 100 characters')
        .escape(),
    body('pay_rate')
        .isFloat({ min: 0, max: 1000 })
        .withMessage('Pay rate must be between 0 and 1000'),
    body('phone')
        .optional()
        .isMobilePhone('any')
        .withMessage('Valid phone number required'),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Address must not exceed 500 characters')
        .escape(),
    validateRequest
];

// ID parameter validation
const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID must be a positive integer'),
    validateRequest
];

// UID parameter validation
const validateUid = [
    param('uid')
        .isLength({ min: 1, max: 128 })
        .withMessage('UID must be provided and valid'),
    validateRequest
];

const validateShiftTemplate = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Template name must be between 2 and 100 characters')
        .escape(),
    body('start_time')
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Start time must be in HH:MM format'),
    body('duration_minutes')
        .isInt({ min: 30, max: 1440 })
        .withMessage('Duration must be between 30 minutes and 24 hours'),
    validateRequest
];

// Date query validation
const validateDateQuery = [
    query('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be in ISO8601 format (YYYY-MM-DD)'),
    query('start_date')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO8601 format'),
    query('end_date')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO8601 format'),
    validateRequest
];

module.exports = {
    validateTransaction,
    validateUser,
    validateEmployee,
    validateShiftTemplate, // Add this
    validateId,
    validateUid,
    validateDateQuery,
    validateRequest
};
