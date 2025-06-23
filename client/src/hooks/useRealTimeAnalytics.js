// client/src/hooks/useRealTimeAnalytics.js
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import apiService from '../services/api';

export const useRealTimeAnalytics = () => {
    const [metrics, setMetrics] = useState(null);
    const [forecast, setForecast] = useState(null);
    const [peakHours, setPeakHours] = useState(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

        socket.on('connect', () => {
            console.log('📡 Connected to real-time analytics');
            setConnected(true);
            socket.emit('join-analytics');
        });

        socket.on('disconnect', () => {
            console.log('📡 Disconnected from real-time analytics');
            setConnected(false);
        });

        socket.on('analytics-update', (data) => {
            console.log('📊 Received analytics update:', data);
            setMetrics(data);
            setLoading(false);
        });

        socket.on('connect_error', (error) => {
            console.error('📡 WebSocket connection error:', error);
            setError('Failed to connect to real-time analytics');
            setConnected(false);
        });

        // Initial data fetch
        const fetchInitialData = async () => {
            try {
                const [metricsData, forecastData, peakHoursData] = await Promise.all([
                    apiService.getRealTimeAnalytics().catch(() => ({ data: null })),
                    apiService.getSalesForecast().catch(() => ({ data: null })),
                    apiService.getPeakHoursAnalysis().catch(() => ({ data: null }))
                ]);

                setMetrics(metricsData.data);
                setForecast(forecastData.data);
                setPeakHours(peakHoursData.data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching initial analytics data:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchInitialData();

        return () => {
            socket.disconnect();
        };
    }, []);

    return {
        metrics,
        forecast,
        peakHours,
        connected,
        loading,
        error
    };
};
