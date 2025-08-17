const express = require('express');
const router = express.Router();
const analyticsService = require('../services/analyticsService');
const { adminOrSecondaryAdmin } = require('../middleware/auth');

router.get('/real-time', async (req, res) => {
    try {
        const metrics = await analyticsService.getRealTimeSalesMetrics();
        res.json({ data: metrics });
    } catch (error) {
        console.error('Error fetching real-time analytics:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

router.get('/forecast', adminOrSecondaryAdmin, async (req, res) => {
    try {
        const forecast = await analyticsService.getSalesForecast();
        res.json({ data: forecast });
    } catch (error) {
        console.error('Error fetching sales forecast:', error);
        res.status(500).json({ error: 'Failed to fetch forecast' });
    }
});

router.get('/peak-hours', adminOrSecondaryAdmin, async (req, res) => {
    try {
        const peakHours = await analyticsService.getPeakHoursAnalysis();
        res.json({ data: peakHours });
    } catch (error) {
        console.error('Error fetching peak hours analysis:', error);
        res.status(500).json({ error: 'Failed to fetch peak hours analysis' });
    }
});

module.exports = router;
