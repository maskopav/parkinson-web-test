// Database module using IndexedDB
class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = CONFIG.DATABASE.NAME;
        this.dbVersion = CONFIG.DATABASE.VERSION;
        this.patientsTable = CONFIG.DATABASE?.PATIENTS_TABLE || 'patients';
        this.recordingsTable = CONFIG.DATABASE?.RECORDINGS_TABLE || 'recordings';
        this.readyPromise = this.init();
        this.isReady = false;
    }

    async init() {
        try {
            this.db = await this.openDatabase();
            this.isReady = true;
            console.log(`Database "${this.dbName}" v${this.dbVersion} initialized successfully`);
            return this.db;
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw new Error(`Database initialization failed: ${error.message}`);
        }
    }

    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                const error = request.error || new Error('Failed to open database');
                reject(error);
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
        try {
            // Create the patients object store
            if (!db.objectStoreNames.contains(this.patientsTable)) {
                db.createObjectStore(this.patientsTable, { keyPath: 'id' });
                patientStore.createIndex('id', { unique: true });
                patientStore.createIndex('firstName', 'firstName', { unique: false });
                patientStore.createIndex('lastName', 'lastName', { unique: false });
                patientStore.createIndex('dateOfBirth', 'dateOfBirth', { unique: false });
                patientStore.createIndex('fullName', ['firstName', 'lastName'], { unique: false });
                patientStore.createIndex('createdAt', 'createdAt', { unique: false });
            }

            // Create the recordings object store
            if (!db.objectStoreNames.contains(this.recordingsTable)) {
                const recordingStore = db.createObjectStore(this.recordingsTable, { keyPath: 'id', autoIncrement: true });
                recordingStore.createIndex('patientId', 'patientId', { unique: false });
                recordingStore.createIndex('dateTime', 'dateTime', { unique: false });
                recordingStore.createIndex('mimeType', 'mimeType', { unique: false });
                recordingStore.createIndex('patientDateTime', ['patientId', 'dateTime'], { unique: false });
            }

            // Create the test assignments object store
            if (!db.objectStoreNames.contains('test-assignments')) {
                const assignmentsStore = db.createObjectStore('test-assignments', { keyPath: 'id' });
                assignmentsStore.createIndex('patientId', 'patientId', { unique: false });
            }
            
            console.log('Database upgrade complete. Stores created/updated.');
        } catch (error) {
            console.error('Error creating tables:', error);
            throw error;
        }
    }

    // Utility method to ensure database is ready
    async ensureReady() {
        if (!this.isReady) {
            await this.readyPromise;
        }
        if (!this.db) {
            throw new Error('Database not initialized');
        }
    }

    // Enhanced transaction wrapper with better error handling
    async executeTransaction(storeNames, mode, operation) {
        await this.ensureReady();
        
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeNames, mode);
                
                transaction.onerror = () => {
                    reject(new Error(`Transaction failed: ${transaction.error?.message || 'Unknown error'}`));
                };

                transaction.onabort = () => {
                    reject(new Error('Transaction was aborted'));
                };

                const result = operation(transaction);
                
                if (result instanceof Promise) {
                    result.then(resolve).catch(reject);
                } else {
                    resolve(result);
                }

            } catch (error) {
                reject(error);
            }
        });
    }

    // PATIENT OPERATIONS

    async addPatient(patientData) {
        if (!patientData || !patientData.firstName || !patientData.lastName) {
            throw new Error('Patient data must include firstName and lastName');
        }

        const patient = {
            firstName: String(patientData.firstName).trim(),
            lastName: String(patientData.lastName).trim(),
            dateOfBirth: patientData.dateOfBirth || null,
            gender: patientData.gender || null,
            email: patientData.email || null,
            phone: patientData.phone || null,
            medicalHistory: patientData.medicalHistory || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        return this.executeTransaction([this.patientsTable], 'readwrite', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.patientsTable);
                const request = store.add(patient);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error('Failed to add patient'));
            });
        });
    }

    async getPatient(patientId) {
        if (!patientId) {
            throw new Error('Patient ID is required');
        }

        return this.executeTransaction([this.patientsTable], 'readonly', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.patientsTable);
                const request = store.get(Number(patientId));

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(new Error('Failed to get patient'));
            });
        });
    }

    async updatePatient(patientData) {
        if (!patientData?.id) {
            throw new Error('Patient data must include an ID');
        }

        const updatedPatient = {
            ...patientData,
            id: Number(patientData.id),
            updatedAt: new Date().toISOString()
        };

        return this.executeTransaction([this.patientsTable], 'readwrite', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.patientsTable);
                const request = store.put(updatedPatient);

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(new Error('Failed to update patient'));
            });
        });
    }

    async deletePatient(patientId) {
        if (!patientId) {
            throw new Error('Patient ID is required');
        }

        return this.executeTransaction([this.patientsTable, this.recordingsTable], 'readwrite', (transaction) => {
            return new Promise(async (resolve, reject) => {
                try {
                    const patientStore = transaction.objectStore(this.patientsTable);
                    const recordingStore = transaction.objectStore(this.recordingsTable);
                    const recordingIndex = recordingStore.index('patientId');

                    // Delete all recordings for this patient first
                    const recordingsRequest = recordingIndex.getAll(Number(patientId));
                    recordingsRequest.onsuccess = () => {
                        const recordings = recordingsRequest.result;
                        const deletePromises = recordings.map(recording => {
                            return new Promise((res, rej) => {
                                const deleteRequest = recordingStore.delete(recording.id);
                                deleteRequest.onsuccess = () => res();
                                deleteRequest.onerror = () => rej(deleteRequest.error);
                            });
                        });

                        Promise.all(deletePromises).then(() => {
                            // Now delete the patient
                            const patientRequest = patientStore.delete(Number(patientId));
                            patientRequest.onsuccess = () => resolve(true);
                            patientRequest.onerror = () => reject(new Error('Failed to delete patient'));
                        }).catch(reject);
                    };
                    recordingsRequest.onerror = () => reject(new Error('Failed to delete patient recordings'));
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async searchPatients(searchCriteria) {
        const { firstName, lastName, dateOfBirth, limit = 100 } = searchCriteria;

        return this.executeTransaction([this.patientsTable], 'readonly', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.patientsTable);
                const request = store.getAll();

                request.onsuccess = () => {
                    let patients = request.result;

                    // Apply filters
                    if (firstName) {
                        const searchTerm = firstName.toLowerCase().trim();
                        patients = patients.filter(p => 
                            p.firstName?.toLowerCase().includes(searchTerm)
                        );
                    }

                    if (lastName) {
                        const searchTerm = lastName.toLowerCase().trim();
                        patients = patients.filter(p => 
                            p.lastName?.toLowerCase().includes(searchTerm)
                        );
                    }

                    if (dateOfBirth) {
                        patients = patients.filter(p => p.dateOfBirth === dateOfBirth);
                    }

                    // Sort by creation date (newest first) and limit results
                    patients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    patients = patients.slice(0, limit);

                    resolve(patients);
                };
                request.onerror = () => reject(new Error('Failed to search patients'));
            });
        });
    }

    async getAllPatients() {
        return this.executeTransaction([this.patientsTable], 'readonly', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.patientsTable);
                const request = store.getAll();

                request.onsuccess = () => {
                    const patients = request.result.sort((a, b) => 
                        new Date(b.createdAt) - new Date(a.createdAt)
                    );
                    resolve(patients);
                };
                request.onerror = () => reject(new Error('Failed to get all patients'));
            });
        });
    }

    // RECORDING OPERATIONS

    async addRecording(recordingData) {
        if (!recordingData?.patientId || !recordingData?.audioBlob) {
            throw new Error('Recording data must include patientId and audioBlob');
        }

        const recording = {
            patientId: Number(recordingData.patientId),
            dateTime: recordingData.dateTime || new Date().toISOString(),
            audioBlob: recordingData.audioBlob,
            duration: recordingData.duration || 0,
            mimeType: recordingData.mimeType || 'audio/wav',
            fileSize: recordingData.fileSize || recordingData.audioBlob.size,
            metadata: recordingData.metadata || {},
            createdAt: new Date().toISOString()
        };

        return this.executeTransaction([this.recordingsTable], 'readwrite', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.recordingsTable);
                const request = store.add(recording);
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error('Failed to add recording'));
            });
        });
    }

    async getRecording(recordingId) {
        if (!recordingId) {
            throw new Error('Recording ID is required');
        }

        return this.executeTransaction([this.recordingsTable], 'readonly', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.recordingsTable);
                const request = store.get(Number(recordingId));

                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(new Error('Failed to get recording'));
            });
        });
    }

    async getPatientRecordings(patientId, sortOrder = 'desc') {
        if (!patientId) {
            throw new Error('Patient ID is required');
        }

        return this.executeTransaction([this.recordingsTable], 'readonly', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.recordingsTable);
                const index = store.index('patientId');
                const request = index.getAll(Number(patientId));

                request.onsuccess = () => {
                    const recordings = request.result;
                    // Sort by dateTime
                    recordings.sort((a, b) => {
                        const dateA = new Date(a.dateTime);
                        const dateB = new Date(b.dateTime);
                        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                    });
                    resolve(recordings);
                };
                request.onerror = () => reject(new Error('Failed to get patient recordings'));
            });
        });
    }

    async deleteRecording(recordingId) {
        if (!recordingId) {
            throw new Error('Recording ID is required');
        }

        return this.executeTransaction([this.recordingsTable], 'readwrite', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.recordingsTable);
                const request = store.delete(Number(recordingId));

                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(new Error('Failed to delete recording'));
            });
        });
    }

    async getAllRecordings() {
        return this.executeTransaction([this.recordingsTable], 'readonly', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(this.recordingsTable);
                const request = store.getAll();

                request.onsuccess = () => {
                    const recordings = request.result.sort((a, b) => 
                        new Date(b.dateTime) - new Date(a.dateTime)
                    );
                    resolve(recordings);
                };
                request.onerror = () => reject(new Error('Failed to get all recordings'));
            });
        });
    }

    // TESTS OPERATIONS
    async addTestAssignment(assignmentData) {
        if (!assignmentData) {
            throw new Error('Test assignment data is required');
        }
    
        return this.executeTransaction(['test-assignments'], 'readwrite', (transaction) => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore('test-assignments');
                const request = store.add(assignmentData);
    
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error('Failed to add test assignment'));
            });
        });
    }


    // UTILITY METHODS

    async clearDatabase() {
        return this.executeTransaction([this.patientsTable, this.recordingsTable], 'readwrite', (transaction) => {
            return new Promise((resolve, reject) => {
                try {
                    const patientStore = transaction.objectStore(this.patientsTable);
                    const recordingStore = transaction.objectStore(this.recordingsTable);
                    
                    let completedOperations = 0;
                    const totalOperations = 2;

                    const checkCompletion = () => {
                        completedOperations++;
                        if (completedOperations === totalOperations) {
                            console.log('Database cleared successfully');
                            resolve(true);
                        }
                    };

                    const patientClearRequest = patientStore.clear();
                    patientClearRequest.onsuccess = checkCompletion;
                    patientClearRequest.onerror = () => reject(new Error('Failed to clear patients'));

                    const recordingClearRequest = recordingStore.clear();
                    recordingClearRequest.onsuccess = checkCompletion;
                    recordingClearRequest.onerror = () => reject(new Error('Failed to clear recordings'));

                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    async getDatabaseStats() {
        try {
            const [patients, recordings] = await Promise.all([
                this.getAllPatients(),
                this.getAllRecordings()
            ]);

            const totalSize = this.calculateStorageSize(recordings);
            
            return {
                totalPatients: patients.length,
                totalRecordings: recordings.length,
                totalStorageBytes: totalSize,
                totalStorageMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
                averageRecordingSize: recordings.length > 0 ? Math.round(totalSize / recordings.length) : 0,
                oldestPatient: patients.length > 0 ? patients.reduce((oldest, patient) => 
                    new Date(patient.createdAt) < new Date(oldest.createdAt) ? patient : oldest
                ) : null,
                newestPatient: patients.length > 0 ? patients.reduce((newest, patient) => 
                    new Date(patient.createdAt) > new Date(newest.createdAt) ? patient : newest
                ) : null
            };
        } catch (error) {
            console.error('Error getting database stats:', error);
            throw error;
        }
    }

    calculateStorageSize(recordings) {
        return recordings.reduce((total, recording) => {
            return total + (recording.fileSize || 0);
        }, 0);
    }

    // Export/Import functionality
    async exportData() {
        try {
            const [patients, recordings] = await Promise.all([
                this.getAllPatients(),
                this.getAllRecordings()
            ]);

            // Note: This excludes audio blobs for size reasons
            // Audio blobs would need special handling for export
            const exportData = {
                version: this.dbVersion,
                exportDate: new Date().toISOString(),
                patients: patients,
                recordings: recordings.map(r => ({
                    ...r,
                    audioBlob: null, // Exclude large binary data
                    hasAudio: !!r.audioBlob
                }))
            };

            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw error;
        }
    }

    async getStorageQuota() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            try {
                const estimate = await navigator.storage.estimate();
                return {
                    quota: estimate.quota,
                    usage: estimate.usage,
                    available: estimate.quota - estimate.usage,
                    usagePercentage: Math.round((estimate.usage / estimate.quota) * 100)
                };
            } catch (error) {
                console.warn('Could not get storage estimate:', error);
                return null;
            }
        }
        return null;
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isReady = false;
            console.log('Database connection closed');
        }
    }
}

// Helper class for database queries
class DatabaseQueryBuilder {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    // Advanced patient search with multiple criteria
    async searchPatientsAdvanced(criteria) {
        const {
            firstName,
            lastName,
            ageRange,
            gender,
            hasRecordings,
            createdAfter,
            createdBefore,
            limit = 50,
            offset = 0
        } = criteria;

        const patients = await this.dbManager.getAllPatients();
        let filtered = patients;

        // Apply filters
        if (firstName) {
            const searchTerm = firstName.toLowerCase();
            filtered = filtered.filter(p => 
                p.firstName?.toLowerCase().includes(searchTerm)
            );
        }

        if (lastName) {
            const searchTerm = lastName.toLowerCase();
            filtered = filtered.filter(p => 
                p.lastName?.toLowerCase().includes(searchTerm)
            );
        }

        if (gender) {
            filtered = filtered.filter(p => p.gender === gender);
        }

        if (ageRange && ageRange.min !== undefined || ageRange.max !== undefined) {
            const currentYear = new Date().getFullYear();
            filtered = filtered.filter(p => {
                if (!p.dateOfBirth) return false;
                const birthYear = new Date(p.dateOfBirth).getFullYear();
                const age = currentYear - birthYear;
                return (ageRange.min === undefined || age >= ageRange.min) &&
                       (ageRange.max === undefined || age <= ageRange.max);
            });
        }

        if (createdAfter) {
            const afterDate = new Date(createdAfter);
            filtered = filtered.filter(p => new Date(p.createdAt) > afterDate);
        }

        if (createdBefore) {
            const beforeDate = new Date(createdBefore);
            filtered = filtered.filter(p => new Date(p.createdAt) < beforeDate);
        }

        if (hasRecordings !== undefined) {
            // This would require checking recordings for each patient
            // Implementation depends on performance requirements
        }

        // Pagination
        const paginated = filtered.slice(offset, offset + limit);

        return {
            patients: paginated,
            total: filtered.length,
            hasMore: offset + limit < filtered.length
        };
    }
}
