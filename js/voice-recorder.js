// Voice recorder module
class VoiceRecorder {
    constructor(databaseManager, patientManager) {
        this.db = databaseManager;
        this.patientManager = patientManager;
        
        // DOM elements
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resumeBtn = document.getElementById('resume-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.saveRecordingBtn = document.getElementById('save-recording-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.statusText = document.getElementById('status-text');
        this.statusIndicator = document.getElementById('status-indicator');
        this.recordingTime = document.getElementById('recording-time');
        this.levelIndicator = document.getElementById('level-indicator');
        this.audioPlayer = document.getElementById('audio-player');
        this.audioPlayback = document.getElementById('audio-playback');
        this.errorMessage = document.getElementById('error-message');

        // Recording state
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.isPaused = false;
        this.startTime = null;
        this.pausedDuration = 0;
        this.timerInterval = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.recordingBlob = null;
        this.recordingDuration = 0;

        this.init();
    }

    init() {
        // Check for browser support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Audio recording is not supported in this browser. Use Chrome, Edge, Safari 14+, or Firefox.');
            return;
        }

        this.bindEvents();
        console.log('Voice Recorder initialized');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.pauseBtn.addEventListener('click', () => this.pauseRecording());
        this.resumeBtn.addEventListener('click', () => this.resumeRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
        this.saveRecordingBtn.addEventListener('click', () => this.saveRecordingToDatabase());
        this.downloadBtn.addEventListener('click', () => this.downloadRecording());
    }

    async startRecording() {
        // iOS/Safari constraints: secure context (https) and user gesture
        if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            this.showError('Recording requires a secure context (https) on mobile. Use the HTTPS server or connect via localhost.');
            return;
        }

        if (!this.patientManager.getCurrentPatient()) {
            this.showError('Please select or create a patient before recording.');
            return;
        }

        try {
            // Request microphone access with mobile-friendly constraints
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Setup audio context for visualization
            this.setupAudioVisualization();

            // Create MediaRecorder
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(this.audioStream, { mimeType });

            // Setup MediaRecorder event listeners
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };

            // Start recording
            this.audioChunks = [];
            this.mediaRecorder.start(CONFIG.RECORDING.CHUNK_INTERVAL);
            
            // Update state
            this.isRecording = true;
            this.isPaused = false;
            this.startTime = Date.now();
            this.pausedDuration = 0;
            
            // Start timer and visualization
            this.startTimer();
            this.startVisualization();
            
            // Update UI
            this.updateUI();
            this.hideError();

        } catch (error) {
            console.error('Error starting recording:', error);
            if (error && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
                this.showError('Microphone access was blocked. On iPhone: use Safari, ensure HTTPS, and allow microphone permissions in Settings > Safari > Camera/Microphone.');
            } else if (error && error.name === 'NotFoundError') {
                this.showError('No microphone was found. Check your device permissions and try again.');
            } else {
                this.showError('Could not access microphone. Ensure HTTPS on mobile and allow permissions, then try again.');
            }
        }
    }

    pauseRecording() {
        if (this.mediaRecorder && this.isRecording && !this.isPaused) {
            this.mediaRecorder.pause();
            this.isPaused = true;
            this.pausedDuration += Date.now() - this.startTime;
            this.stopTimer();
            this.stopVisualization();
            this.updateUI();
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.isRecording && this.isPaused) {
            this.mediaRecorder.resume();
            this.isPaused = false;
            this.startTime = Date.now();
            this.startTimer();
            this.startVisualization();
            this.updateUI();
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.isPaused = false;
            
            // Calculate final duration
            this.recordingDuration = Date.now() - this.startTime + this.pausedDuration;
            
            // Stop all streams
            if (this.audioStream) {
                this.audioStream.getTracks().forEach(track => track.stop());
            }
            
            // Stop timer and visualization
            this.stopTimer();
            this.stopVisualization();
            
            // Clean up audio context
            if (this.audioContext) {
                this.audioContext.close();
            }
            
            this.updateUI();
        }
    }

    processRecording() {
        if (this.audioChunks.length > 0) {
            this.recordingBlob = new Blob(this.audioChunks, { 
                type: this.getSupportedMimeType() 
            });
            
            const audioUrl = URL.createObjectURL(this.recordingBlob);
            
            // Setup audio player
            this.audioPlayer.src = audioUrl;
            this.audioPlayback.style.display = 'block';
            
            console.log('Recording processed successfully');
        }
    }

    async saveRecordingToDatabase() {
        if (!this.recordingBlob) {
            this.showError('No recording available to save.');
            return;
        }

        const currentPatient = this.patientManager.getCurrentPatient();
        if (!currentPatient) {
            this.showError('No patient selected. Please select a patient first.');
            return;
        }

        try {
            const recordingData = {
                patientId: currentPatient.id,
                audioBlob: this.recordingBlob,
                duration: this.recordingDuration,
                mimeType: this.getSupportedMimeType(),
                fileSize: this.recordingBlob.size
            };

            const recordingId = await this.db.addRecording(recordingData);
            
            this.showPersistentNotice(`Recording saved successfully with ID: ${recordingId}`, 'success');
            
            // Update database status
            this.updateDatabaseStatus();
            
        } catch (error) {
            console.error('Error saving recording:', error);
            this.showPersistentNotice('Error saving recording to database. Please try again.', 'error');
        }
    }

    downloadRecording() {
        if (this.recordingBlob) {
            const url = URL.createObjectURL(this.recordingBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `parkinson-voice-test-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    setupAudioVisualization() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.audioStream);
            
            this.analyser.fftSize = 256;
            this.microphone.connect(this.analyser);
        } catch (error) {
            console.warn('Audio visualization not available:', error);
        }
    }

    startVisualization() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevel = () => {
            if (!this.isRecording || this.isPaused) return;

            this.analyser.getByteFrequencyData(dataArray);
            
            // Calculate average volume
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const percentage = (average / 255) * 100;
            
            // Update level indicator
            this.levelIndicator.style.width = percentage + '%';
            
            // Continue animation
            requestAnimationFrame(updateLevel);
        };

        updateLevel();
    }

    stopVisualization() {
        if (this.levelIndicator) {
            this.levelIndicator.style.width = '0%';
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime + this.pausedDuration;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            this.recordingTime.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, CONFIG.UI.TIMER_UPDATE_INTERVAL);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateUI() {
        // Update button states
        this.startBtn.disabled = this.isRecording;
        this.pauseBtn.disabled = !this.isRecording || this.isPaused;
        this.resumeBtn.disabled = !this.isRecording || !this.isPaused;
        this.stopBtn.disabled = !this.isRecording;

        // Update status
        if (this.isRecording && !this.isPaused) {
            this.statusText.textContent = 'Recording...';
            this.statusIndicator.className = 'status-indicator recording';
        } else if (this.isRecording && this.isPaused) {
            this.statusText.textContent = 'Recording Paused';
            this.statusIndicator.className = 'status-indicator paused';
        } else {
            this.statusText.textContent = 'Ready to Record';
            this.statusIndicator.className = 'status-indicator idle';
            this.recordingTime.textContent = '00:00';
        }
    }

    getSupportedMimeType() {
        for (const type of CONFIG.RECORDING.SUPPORTED_FORMATS) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        // iOS Safari often supports audio/mp4
        return 'audio/mp4';
    }

    async updateDatabaseStatus() {
        try {
            const stats = await this.db.getDatabaseStats();
            const dbStatusElement = document.getElementById('db-status');
            
            dbStatusElement.innerHTML = `
                <div class="db-stats">
                    <h4>Database Statistics</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <strong>Total Patients:</strong> ${stats.totalPatients}
                        </div>
                        <div class="stat-item">
                            <strong>Total Recordings:</strong> ${stats.totalRecordings}
                        </div>
                        <div class="stat-item">
                            <strong>Total Storage:</strong> ${this.formatBytes(stats.totalStorage)}
                        </div>
                    </div>
                </div>
            `;
            
            dbStatusElement.style.display = 'block';
        } catch (error) {
            console.error('Error updating database status:', error);
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.errorMessage.scrollIntoView({ behavior: 'smooth' });
    }

    showPersistentNotice(message, type = 'info') {
        let banner = document.getElementById('recording-message');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'recording-message';
            banner.className = 'info-banner';
            this.audioPlayback.parentNode.insertBefore(banner, this.audioPlayback);
        }
        banner.textContent = message;
        banner.className = `info-banner ${type}`;
        banner.style.display = 'block';
    }

    showSuccess(message) {
        // Create persistent success banner instead of auto-dismissing toast
        this.showPersistentNotice(message, 'success');
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    // Public method to check if recording is available
    hasRecording() {
        return this.recordingBlob !== null;
    }

    // Public method to get recording data
    getRecordingData() {
        if (!this.recordingBlob) return null;
        
        return {
            blob: this.recordingBlob,
            duration: this.recordingDuration,
            mimeType: this.getSupportedMimeType(),
            fileSize: this.recordingBlob.size
        };
    }
}
