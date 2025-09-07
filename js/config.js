// Configuration file for Parkinson Web Test Application
const CONFIG = {
    // Database configuration
    DATABASE: {
        NAME: 'parkinson_test_db',
        VERSION: 1,
        PATIENTS_TABLE: 'patients',
        RECORDINGS_TABLE: 'recordings'
    },
    
    // Patient form validation
    VALIDATION: {
        MIN_NAME_LENGTH: 2,
        MAX_NAME_LENGTH: 50,
        MIN_AGE: 18,
        MAX_AGE: 120
    },
    
    // Recording settings
    RECORDING: {
        CHUNK_INTERVAL: 100, // milliseconds
        SUPPORTED_FORMATS: [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus'
        ]
    },
    
    // UI settings
    UI: {
        ANIMATION_DURATION: 300,
        BANNER_DURATION: 10000,
        TIMER_UPDATE_INTERVAL: 100,
        VISUALIZATION_UPDATE_INTERVAL: 16 // ~60fps
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
