/**
 * TestManager Module
 * Manages the definition, configuration, and retrieval of different tests.
 * This is a foundational step for a modular test management system.
 */
class TestManager {
    constructor(databaseManager) {
        this.db = databaseManager; // To access the database
        this.testRegistry = new Map(); // A registry to hold all available tests
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

    // Method to save a new test assignment to the database
    async saveTestAssignment(patientId, selectedTests) {
        try {
            const assignmentId = this.generateUniqueId();
            const assignment = {
                id: assignmentId,
                patientId: patientId,
                tests: selectedTests,
                createdAt: new Date().toISOString()
            };

            await this.db.addTestAssignment(assignment);
            console.log(`Test assignment created for patient ${patientId} with ID: ${assignmentId}`);
            return assignmentId;
        } catch (error) {
            console.error('Error saving test assignment:', error);
            throw error;
        }
    }

    // Method to retrieve a test assignment from the database
    async getTestAssignment(assignmentId) {
        try {
            const assignment = await this.db.get('test-assignments', assignmentId);
            return assignment;
        } catch (error) {
            console.error('Error retrieving test assignment:', error);
            return null;
        }
    }

    // A simple utility to generate a unique ID
    generateUniqueId() {
        return 'assignment-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
}
