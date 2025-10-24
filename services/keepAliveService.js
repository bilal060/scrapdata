const axios = require('axios');

class KeepAliveService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.serverUrl = process.env.SERVER_URL || 'http://192.168.1.104:8888';
        this.apiKey = process.env.API_KEY || 'android-notification-capture-2024-secure-key-v2';
        this.intervalMinutes = 5; // Ping every 5 minutes
    }

    /**
     * Start the keep-alive service
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Keep-alive service is already running');
            return;
        }

        console.log(`🔄 Starting keep-alive service - pinging every ${this.intervalMinutes} minutes`);
        this.isRunning = true;

        // Initial ping
        this.pingServer();

        // Set up interval for regular pings
        this.intervalId = setInterval(() => {
            this.pingServer();
        }, this.intervalMinutes * 60 * 1000); // Convert minutes to milliseconds
    }

    /**
     * Stop the keep-alive service
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Keep-alive service is not running');
            return;
        }

        console.log('🛑 Stopping keep-alive service');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Ping the server to keep it alive
     */
    async pingServer() {
        try {
            const timestamp = new Date().toISOString();
            console.log(`🔄 Keep-alive ping at ${timestamp}`);

            const response = await axios.post(`${this.serverUrl}/api/text-inputs/keep-alive`, {}, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                timeout: 10000 // 10 second timeout
            });

            if (response.status === 200) {
                console.log(`✅ Keep-alive ping successful: ${response.data.message}`);
            } else {
                console.log(`⚠️ Keep-alive ping returned status: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Keep-alive ping failed:', error.message);
            
            // Try GET method as fallback
            try {
                console.log('🔄 Trying GET method as fallback...');
                const getResponse = await axios.get(`${this.serverUrl}/api/text-inputs/keep-alive`, {
                    headers: {
                        'X-API-Key': this.apiKey
                    },
                    timeout: 10000
                });

                if (getResponse.status === 200) {
                    console.log(`✅ Keep-alive GET ping successful: ${getResponse.data.message}`);
                }
            } catch (getError) {
                console.error('❌ Keep-alive GET ping also failed:', getError.message);
            }
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            intervalMinutes: this.intervalMinutes,
            serverUrl: this.serverUrl,
            nextPingIn: this.isRunning ? this.intervalMinutes * 60 * 1000 : 0
        };
    }

    /**
     * Update ping interval
     */
    setInterval(minutes) {
        if (minutes < 1) {
            console.log('⚠️ Interval must be at least 1 minute');
            return;
        }

        this.intervalMinutes = minutes;
        console.log(`🔄 Keep-alive interval updated to ${minutes} minutes`);

        // Restart service with new interval
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
}

module.exports = new KeepAliveService();
