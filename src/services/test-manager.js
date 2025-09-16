/**
 * TestManager Module
 * Manages the definition, configuration, and retrieval of different tests.
 * This is a foundational step for a modular test management system.
 */
class TestManager {
    constructor() {
        // A registry to hold all available tests
        this.testRegistry = new Map();
        this.init();
    }

    /**
     * Initializes the registry with all defined test types.
     * In a production app, this could dynamically load modules.
     */
    init() {
        console.log('Initializing TestManager...');
        
        // Register the existing voice recording test
        this.registerTest({
            id: 'voice-recording',
            name: 'Voice Recording',
            description: 'A test to record the patient\'s voice.',
            moduleId: 'voice-recorder', // Reference to the file name
            parameters: {} // Placeholder for test-specific settings
        });

        // Add tests here
        
        console.log('TestManager initialized with available tests:', this.testRegistry);
    }

    /**
     * Registers a new test type with the manager.
     * @param {object} testConfig The configuration object for the new test.
     */
    registerTest(testConfig) {
        if (!testConfig.id || this.testRegistry.has(testConfig.id)) {
            console.error(`Error: Test with ID '${testConfig.id}' already exists or is invalid.`);
            return;
        }
        this.testRegistry.set(testConfig.id, testConfig);
    }

    /**
     * Retrieves a test configuration by its ID.
     * @param {string} testId The unique ID of the test.
     * @returns {object|undefined} The test configuration or undefined if not found.
     */
    getTest(testId) {
        return this.testRegistry.get(testId);
    }

    /**
     * Retrieves all registered tests.
     * @returns {Array<object>} An array of all registered test configurations.
     */
    getAllTests() {
        return Array.from(this.testRegistry.values());
    }
}

// Ensure the class is globally accessible for other modules to use
window.TestManager = TestManager;