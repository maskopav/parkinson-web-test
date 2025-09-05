// Database module using IndexedDB
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = CONFIG.DATABASE.NAME;
        this.dbVersion = CONFIG.DATABASE.VERSION;
        this.readyPromise = this.init();
    }

    async init() {
        try {
            this.db = await this.openDatabase();
            console.log('Database initialized successfully');
            return this.db;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createTables(db);
            };
        });
    }

    createTables(db) {
        // Create patients table
        if (!db.objectStoreNames.contains(CONFIG.DATABASE.PATIENTS_TABLE)) {
            const patientStore = db.createObjectStore(CONFIG.DATABASE.PATIENTS_TABLE, {
                keyPath: 'id',
                autoIncrement: true
            });
            
            // Create indexes for searching
            patientStore.createIndex('firstName', 'firstName', { unique: false });
            patientStore.createIndex('lastName', 'lastName', { unique: false });
            patientStore.createIndex('dateOfBirth', 'dateOfBirth', { unique: false });
        }

        // Create recordings table
        if (!db.objectStoreNames.contains(CONFIG.DATABASE.RECORDINGS_TABLE)) {
            const recordingStore = db.createObjectStore(CONFIG.DATABASE.RECORDINGS_TABLE, {
                keyPath: 'id',
                autoIncrement: true
            });
            
            // Create indexes for searching
            recordingStore.createIndex('patientId', 'patientId', { unique: false });
            recordingStore.createIndex('dateTime', 'dateTime', { unique: false });
        }
    }

    // Patient operations
    async addPatient(patientData) {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.PATIENTS_TABLE], 'readwrite');
            const store = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);
            
            const patient = {
                firstName: patientData.firstName,
                lastName: patientData.lastName,
                dateOfBirth: patientData.dateOfBirth,
                gender: patientData.gender,
                createdAt: new Date().toISOString()
            };

            const request = store.add(patient);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result); // Returns the auto-generated ID
                };
                request.onerror = () => {
                    reject(new Error('Failed to add patient'));
                };
            });
        } catch (error) {
            console.error('Error adding patient:', error);
            throw error;
        }
    }

    async getPatient(patientId) {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.PATIENTS_TABLE], 'readonly');
            const store = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);
            const request = store.get(parseInt(patientId));

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => {
                    reject(new Error('Failed to get patient'));
                };
            });
        } catch (error) {
            console.error('Error getting patient:', error);
            throw error;
        }
    }

    async updatePatient(updatedPatient) {
        await this.readyPromise;
        if (!updatedPatient || typeof updatedPatient.id !== 'number') {
            throw new Error('updatePatient requires a patient object with a numeric id');
        }
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.PATIENTS_TABLE], 'readwrite');
            const store = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);

            const request = store.put({
                ...updatedPatient,
                updatedAt: new Date().toISOString()
            });

            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(new Error('Failed to update patient'));
            });
        } catch (error) {
            console.error('Error updating patient:', error);
            throw error;
        }
    }

    async getPatientByCompositeKey(firstName, lastName, dateOfBirth) {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.PATIENTS_TABLE], 'readonly');
            const store = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);
            const request = store.getAll();
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const list = request.result || [];
                    const match = list.find(p =>
                        (p.firstName || '').toLowerCase() === (firstName || '').toLowerCase() &&
                        (p.lastName || '').toLowerCase() === (lastName || '').toLowerCase() &&
                        (p.dateOfBirth || '') === (dateOfBirth || '')
                    );
                    resolve(match || null);
                };
                request.onerror = () => reject(new Error('Failed to search patient by composite key'));
            });
        } catch (error) {
            console.error('Error in getPatientByCompositeKey:', error);
            throw error;
        }
    }

    async searchPatientByName(firstName, lastName) {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.PATIENTS_TABLE], 'readonly');
            const store = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const patients = request.result.filter(patient => 
                        patient.firstName.toLowerCase() === firstName.toLowerCase() &&
                        patient.lastName.toLowerCase() === lastName.toLowerCase()
                    );
                    resolve(patients);
                };
                request.onerror = () => {
                    reject(new Error('Failed to search patients'));
                };
            });
        } catch (error) {
            console.error('Error searching patients:', error);
            throw error;
        }
    }

    // Recording operations
    async addRecording(recordingData) {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.RECORDINGS_TABLE], 'readwrite');
            const store = transaction.objectStore(CONFIG.DATABASE.RECORDINGS_TABLE);
            
            const recording = {
                patientId: recordingData.patientId,
                dateTime: new Date().toISOString(),
                audioBlob: recordingData.audioBlob,
                duration: recordingData.duration,
                mimeType: recordingData.mimeType,
                fileSize: recordingData.fileSize
            };

            const request = store.add(recording);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => {
                    reject(new Error('Failed to add recording'));
                };
            });
        } catch (error) {
            console.error('Error adding recording:', error);
            throw error;
        }
    }

    async getPatientRecordings(patientId) {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.RECORDINGS_TABLE], 'readonly');
            const store = transaction.objectStore(CONFIG.DATABASE.RECORDINGS_TABLE);
            const index = store.index('patientId');
            const request = index.getAll(parseInt(patientId));

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => {
                    reject(new Error('Failed to get recordings'));
                };
            });
        } catch (error) {
            console.error('Error getting recordings:', error);
            throw error;
        }
    }

    async getAllRecordings() {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.RECORDINGS_TABLE], 'readonly');
            const store = transaction.objectStore(CONFIG.DATABASE.RECORDINGS_TABLE);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => {
                    reject(new Error('Failed to get all recordings'));
                };
            });
        } catch (error) {
            console.error('Error getting all recordings:', error);
            throw error;
        }
    }

    // Utility methods
    async clearDatabase() {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([
                CONFIG.DATABASE.PATIENTS_TABLE, 
                CONFIG.DATABASE.RECORDINGS_TABLE
            ], 'readwrite');
            
            const patientStore = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);
            const recordingStore = transaction.objectStore(CONFIG.DATABASE.RECORDINGS_TABLE);
            
            await Promise.all([
                patientStore.clear(),
                recordingStore.clear()
            ]);
            
            console.log('Database cleared successfully');
        } catch (error) {
            console.error('Error clearing database:', error);
            throw error;
        }
    }

    async getDatabaseStats() {
        await this.readyPromise;
        try {
            const [patients, recordings] = await Promise.all([
                this.getAllPatients(),
                this.getAllRecordings()
            ]);

            return {
                totalPatients: patients.length,
                totalRecordings: recordings.length,
                totalStorage: this.calculateStorageSize(recordings)
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            throw error;
        }
    }

    async getAllPatients() {
        await this.readyPromise;
        try {
            const transaction = this.db.transaction([CONFIG.DATABASE.PATIENTS_TABLE], 'readonly');
            const store = transaction.objectStore(CONFIG.DATABASE.PATIENTS_TABLE);
            const request = store.getAll();

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    resolve(request.result);
                };
                request.onerror = () => {
                    reject(new Error('Failed to get all patients'));
                };
            });
        } catch (error) {
            console.error('Error getting all patients:', error);
            throw error;
        }
    }

    calculateStorageSize(recordings) {
        return recordings.reduce((total, recording) => {
            return total + (recording.fileSize || 0);
        }, 0);
    }
}
