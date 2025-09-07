// Main application module
class ParkinsonWebTestApp {
    constructor() {
        this.databaseManager = null;
        this.patientManager = null;
        this.voiceRecorder = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing Parkinson Web Test Application...');
            
            // Initialize database first
            this.databaseManager = new DatabaseManager();
            await this.databaseManager.init();
            
            // Initialize other modules
            this.patientManager = new PatientManager(this.databaseManager);
            this.voiceRecorder = new VoiceRecorder(this.databaseManager, this.patientManager);
            
            // Set up global references for debugging
            window.app = this;
            window.db = this.databaseManager;
            window.patientManager = this.patientManager;
            window.voiceRecorder = this.voiceRecorder;
            
            this.isInitialized = true;
            console.log('Application initialized successfully');
            
            // Show initial database status
            await this.showInitialStatus();
            
            // Set up page visibility handling
            this.setupPageVisibilityHandling();
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showGlobalError('Failed to initialize application. Please refresh the page.');
        }
    }

    async showInitialStatus() {
        try {
            const stats = await this.databaseManager.getDatabaseStats();
            console.log('Database statistics:', stats);
            
            // Show database status if there's data
            if (stats.totalPatients > 0 || stats.totalRecordings > 0) {
                const dbStatusElement = document.getElementById('db-status');
                const patientsEl = document.getElementById('stat-total-patients');
                const recordingsEl = document.getElementById('stat-total-recordings');
                const storageEl = document.getElementById('stat-total-storage');

                if (patientsEl) patientsEl.textContent = String(stats.totalPatients);
                if (recordingsEl) recordingsEl.textContent = String(stats.totalRecordings);
                if (storageEl) storageEl.textContent = this.formatBytes(stats.totalStorage);

                if (dbStatusElement) dbStatusElement.style.display = 'block';
            }
        } catch (error) {
            console.error('Error showing initial status:', error);
        }
    }

    setupPageVisibilityHandling() {
        // Handle page visibility changes to pause recording when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.voiceRecorder && this.voiceRecorder.isRecording && !this.voiceRecorder.isPaused) {
                console.log('Page hidden, pausing recording');
                this.voiceRecorder.pauseRecording();
            }
        });

        // Handle beforeunload to warn about unsaved recordings
        window.addEventListener('beforeunload', (e) => {
            if (this.voiceRecorder && this.voiceRecorder.hasRecording()) {
                e.preventDefault();
                e.returnValue = 'You have an unsaved recording. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showGlobalError(message) {
        const errorBanner = document.getElementById('global-error');
        if (!errorBanner) return;
        errorBanner.textContent = message;
        errorBanner.style.display = 'block';
        setTimeout(() => {
            if (errorBanner) errorBanner.style.display = 'none';
        }, 10000);
    }

    // Public methods for external access
    getDatabaseManager() {
        return this.databaseManager;
    }

    getPatientManager() {
        return this.patientManager;
    }

    getVoiceRecorder() {
        return this.voiceRecorder;
    }

    // Utility method to export database
    async exportDatabase() {
        try {
            const [patients, recordings] = await Promise.all([
                this.databaseManager.getAllPatients(),
                this.databaseManager.getAllRecordings()
            ]);

            const exportData = {
                exportDate: new Date().toISOString(),
                patients: patients,
                recordings: recordings.map(recording => ({
                    ...recording,
                    audioBlob: null // Don't export audio blobs in JSON
                }))
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `parkinson-test-export-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            console.log('Database exported successfully');
        } catch (error) {
            console.error('Error exporting database:', error);
            throw error;
        }
    }

    // Utility method to clear database
    async clearDatabase() {
        if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
            try {
                await this.databaseManager.clearDatabase();
                console.log('Database cleared successfully');
                
                // Refresh the page to reset the application state
                window.location.reload();
            } catch (error) {
                console.error('Error clearing database:', error);
                throw error;
            }
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        window.parkinsonApp = new ParkinsonWebTestApp();
        console.log('Parkinson Web Test Application started');
    } catch (error) {
        console.error('Failed to start application:', error);
        const errorBanner = document.getElementById('global-error');
        if (errorBanner) {
            errorBanner.textContent = 'Failed to initialize the application. Please refresh the page.';
            errorBanner.style.display = 'block';
        }
    }
});

// Add some utility functions to the global scope for debugging
window.utils = {
    exportDatabase: () => window.parkinsonApp?.exportDatabase(),
    clearDatabase: () => window.parkinsonApp?.clearDatabase(),
    getDatabaseStats: () => window.parkinsonApp?.getDatabaseManager()?.getDatabaseStats(),
    getAllPatients: () => window.parkinsonApp?.getDatabaseManager()?.getAllPatients(),
    getAllRecordings: () => window.parkinsonApp?.getDatabaseManager()?.getAllRecordings()
};
