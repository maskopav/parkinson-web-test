/**
 * Voice Recorder Module
 * Handles audio recording with pause/resume functionality, visualization, and storage
 */
class VoiceRecorder {
    constructor(databaseManager, patientManager) {
        this.db = databaseManager;
        this.patientManager = patientManager;
        
        // Initialize all components
        this.elements = this.initializeDOMElements();
        this.state = this.initializeState();
        this.recorder = this.initializeRecorderState();
        this.timer = this.initializeTimerState();
        this.audio = this.initializeAudioState();
        
        this.init();
    }

    // =============================================================================
    // INITIALIZATION METHODS
    // =============================================================================
    initializeDOMElements() {
        return {
            // Control buttons
            startBtn: document.getElementById('start-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            resumeBtn: document.getElementById('resume-btn'),
            stopBtn: document.getElementById('stop-btn'),
            saveBtn: document.getElementById('save-recording-btn'),
            downloadBtn: document.getElementById('download-btn'),
            
            // Display elements
            statusText: document.getElementById('status-text'),
            statusIndicator: document.getElementById('status-indicator'),
            recordingTime: document.getElementById('recording-time'),
            levelIndicator: document.getElementById('level-indicator'),
            errorMessage: document.getElementById('error-message'),
            
            // Audio elements
            audioPlayer: document.getElementById('audio-player'),
            audioPlayback: document.getElementById('audio-playback')
        };
    }

    initializeState() {
        return {
            isRecording: false,
            isPaused: false,
            hasRecording: false
        };
    }

    initializeRecorderState() {
        return {
            mediaRecorder: null,
            audioStream: null,
            audioChunks: [],
            recordingBlob: null,
            mimeType: null
        };
    }

    initializeTimerState() {
        return {
            startTime: null,
            pausedDuration: 0,
            totalDuration: 0,
            interval: null
        };
    }

    initializeAudioState() {
        return {
            context: null,
            analyser: null,
            microphone: null,
            animationId: null
        };
    }

    init() {
        if (!this.checkBrowserSupport()) {
            return;
        }
        
        this.bindEventListeners();
        this.updateUI();
        
        console.log('Voice Recorder initialized successfully');
    }

    checkBrowserSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showErrorBanner('Audio recording is not supported in this browser. Use Chrome, Edge, Safari 14+, or Firefox.');
            return false;
        }
        return true;
    }

    bindEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.handleStart());
        this.elements.pauseBtn.addEventListener('click', () => this.handlePause());
        this.elements.resumeBtn.addEventListener('click', () => this.handleResume());
        this.elements.stopBtn.addEventListener('click', () => this.handleStop());
        this.elements.saveBtn.addEventListener('click', () => this.handleSave());
        this.elements.downloadBtn.addEventListener('click', () => this.handleDownload());
    }

    // =============================================================================
    // MAIN RECORDING CONTROL METHODS
    // =============================================================================
    async handleStart() {
        if (!this.validateStartConditions()) {
            return;
        }

        try {
            await this.startRecording();
            console.log('Recording started successfully');
        } catch (error) {
            this.handleRecordingError(error);
        }
    }

    handlePause() {
        if (this.canPause()) {
            this.pauseRecording();
        }
    }

    handleResume() {
        if (this.canResume()) {
            this.resumeRecording();
        }
    }

    handleStop() {
        if (this.canStop()) {
            this.stopRecording();
        }
    }

    async handleSave() {
        if (!this.state.hasRecording) {
            this.showErrorBanner('No recording available to save.');
            return;
        }

        try {
            await this.saveToDatabase();
            this.showSuccessBanner('Recording saved successfully');
        } catch (error) {
            this.showErrorBanner('Failed to save recording. Please try again.');
            console.error('Save error:', error);
        }
    }

    handleDownload() {
        if (this.state.hasRecording) {
            this.downloadRecording();
        }
    }

    // =============================================================================
    // CORE RECORDING FUNCTIONALITY
    // =============================================================================
    async startRecording() {
        // Get microphone access
        this.recorder.audioStream = await this.getMicrophoneAccess();
        
        // Setup recorder
        this.setupMediaRecorder();
        this.setupAudioVisualization();
        
        // Start recording
        this.recorder.mediaRecorder.start(CONFIG.RECORDING.CHUNK_INTERVAL);
        
        // Update state
        this.state.isRecording = true;
        this.state.isPaused = false;
        
        // Start timer and visualization
        this.startTimer();
        this.startVisualization();
        
        // Update UI
        this.updateUI();
        this.hideBanner();
    }

    pauseRecording() {
        this.recorder.mediaRecorder.pause();
        this.state.isPaused = true;
        
        // Update timer
        this.timer.pausedDuration += Date.now() - this.timer.startTime;
        
        // Stop visualization
        this.stopVisualization();
        
        this.updateUI();
    }

    resumeRecording() {
        this.recorder.mediaRecorder.resume();
        this.state.isPaused = false;
        
        // Reset timer
        this.timer.startTime = Date.now();
        
        // Restart visualization
        this.startVisualization();
        
        this.updateUI();
    }

    stopRecording() {
        // Stop recorder
        this.recorder.mediaRecorder.stop();
        
        // Update state
        this.state.isRecording = false;
        this.state.isPaused = false;
        
        // Calculate final duration
        this.timer.totalDuration = this.getCurrentElapsedTime();
        
        // Cleanup
        this.stopVisualization();
        this.cleanupAudioStream();
        this.cleanupAudioContext();
        
        this.processRecording();
        this.updateUI();
    }

    // =============================================================================
    // MEDIA RECORDER SETUP
    // =============================================================================

    async getMicrophoneAccess() {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
        return await navigator.mediaDevices.getUserMedia(constraints);
    }

    setupMediaRecorder() {
        this.recorder.mimeType = this.getSupportedMimeType();
        this.recorder.mediaRecorder = new MediaRecorder(
            this.recorder.audioStream, 
            { mimeType: this.recorder.mimeType }
        );

        // Setup event handlers
        this.recorder.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recorder.audioChunks.push(event.data);
            }
        };

        this.recorder.mediaRecorder.onstop = () => {
            this.processRecording();
        };
    }

    processRecording() {
        if (this.recorder.audioChunks.length === 0) {
            return;
        }

        // Create blob
        this.recorder.recordingBlob = new Blob(
            this.recorder.audioChunks, 
            { type: this.recorder.mimeType }
        );

        // Setup audio player
        const audioUrl = URL.createObjectURL(this.recorder.recordingBlob);
        this.elements.audioPlayer.src = audioUrl;
        this.elements.audioPlayback.style.display = 'block';

        // Update state
        this.state.hasRecording = true;

        console.log('Recording processed successfully');
    }

    // =============================================================================
    // AUDIO VISUALIZATION
    // =============================================================================
    setupAudioVisualization() {
        try {
            this.audio.context = new (window.AudioContext || window.webkitAudioContext)();
            this.audio.analyser = this.audio.context.createAnalyser();
            this.audio.microphone = this.audio.context.createMediaStreamSource(this.recorder.audioStream);
            
            this.audio.analyser.fftSize = 256;
            this.audio.microphone.connect(this.audio.analyser);
        } catch (error) {
            console.warn('Audio visualization not available:', error);
        }
    }

    startVisualization() {
        if (!this.audio.analyser) return;

        const bufferLength = this.audio.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const animate = () => {
            if (!this.state.isRecording || this.state.isPaused) {
                return;
            }

            this.audio.analyser.getByteFrequencyData(dataArray);
            
            // Calculate and display volume level
            const average = this.calculateAverageVolume(dataArray);
            const percentage = (average / 255) * 100;
            this.elements.levelIndicator.style.width = percentage + '%';
            
            this.audio.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    stopVisualization() {
        if (this.audio.animationId) {
            cancelAnimationFrame(this.audio.animationId);
            this.audio.animationId = null;
        }
        
        if (this.elements.levelIndicator) {
            this.elements.levelIndicator.style.width = '0%';
        }
    }

    calculateAverageVolume(dataArray) {
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        return sum / dataArray.length;
    }

    // =============================================================================
    // TIMER FUNCTIONALITY
    // =============================================================================
    startTimer() {
        this.timer.startTime = Date.now();
        this.timer.pausedDuration = 0;
        
        this.timer.interval = setInterval(() => {
            const elapsed = this.getCurrentElapsedTime();
            const formatted = this.formatDuration(elapsed);
            this.elements.recordingTime.textContent = formatted;
        }, CONFIG.UI.TIMER_UPDATE_INTERVAL);
    }

    getCurrentElapsedTime() {
        if (!this.state.isRecording) {
            return this.timer.totalDuration || 0;
        }
        
        if (this.state.isPaused) {
            return this.timer.pausedDuration;
        }
        
        return Date.now() - this.timer.startTime + this.timer.pausedDuration;
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // =============================================================================
    // DATA MANAGEMENT
    // =============================================================================

    async saveToDatabase() {
        const currentPatient = this.patientManager.getCurrentPatient();
        if (!currentPatient) {
            throw new Error('No patient selected');
        }

        const recordingData = {
            patientId: currentPatient.id,
            audioBlob: this.recorder.recordingBlob,
            duration: this.timer.totalDuration,
            mimeType: this.recorder.mimeType,
            fileSize: this.recorder.recordingBlob.size
        };

        const recordingId = await this.db.addRecording(recordingData);
        await this.updateDatabaseStatus();
        
        return recordingId;
    }

    downloadRecording() {
        const url = URL.createObjectURL(this.recorder.recordingBlob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = this.generateFilename();
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    generateFilename() {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const duration = this.formatDuration(this.timer.totalDuration);
        const extension = this.getFileExtension();
        
        return `parkinson-voice-test-${timestamp}-${duration.replace(':', 'm')}s${extension}`;
    }

    // =============================================================================
    // UI MANAGEMENT
    // =============================================================================
    updateUI() {
        this.updateButtons();
        this.updateStatus();
        this.updateTimer();
    }

    updateButtons() {
        this.elements.startBtn.disabled = this.state.isRecording;
        this.elements.pauseBtn.disabled = !this.canPause();
        this.elements.resumeBtn.disabled = !this.canResume();
        this.elements.stopBtn.disabled = !this.canStop();
        this.elements.saveBtn.disabled = !this.state.hasRecording;
        this.elements.downloadBtn.disabled = !this.state.hasRecording;
    }

    updateStatus() {
        if (this.state.isRecording && !this.state.isPaused) {
            this.elements.statusText.textContent = 'Recording...';
            this.elements.statusIndicator.className = 'status-indicator recording';
        } else if (this.state.isRecording && this.state.isPaused) {
            this.elements.statusText.textContent = 'Recording Paused';
            this.elements.statusIndicator.className = 'status-indicator paused';
        } else {
            this.elements.statusText.textContent = 'Ready to Record';
            this.elements.statusIndicator.className = 'status-indicator idle';
        }
    }

    updateTimer() {
        if (!this.state.isRecording && !this.state.hasRecording) {
            this.elements.recordingTime.textContent = '00:00';
        }
    }

    // =============================================================================
    // VALIDATION METHODS
    // =============================================================================
    validateStartConditions() {
        if (!this.checkSecureContext()) {
            return false;
        }
        
        if (!this.patientManager.getCurrentPatient()) {
            this.showErrorBanner('Please select or create a patient before recording.');
            return false;
        }
        
        return true;
    }

    checkSecureContext() {
        const isSecure = location.protocol === 'https:' || 
                        location.hostname === 'localhost' || 
                        location.hostname === '127.0.0.1';
                        
        if (!isSecure) {
            this.showErrorBanner('Recording requires a secure context (https) on mobile. Use HTTPS or connect via localhost.');
            return false;
        }
        
        return true;
    }

    canPause() {
        return this.state.isRecording && !this.state.isPaused;
    }

    canResume() {
        return this.state.isRecording && this.state.isPaused;
    }

    canStop() {
        return this.state.isRecording;
    }

    // =============================================================================
    // ERROR HANDLING & MESSAGING
    // =============================================================================
    handleRecordingError(error) {
        console.error('Recording error:', error);
        
        if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
            this.showErrorBanner('Microphone access was blocked. Please allow microphone permissions and try again.');
        } else if (error?.name === 'NotFoundError') {
            this.showErrorBanner('No microphone found. Please check your device and try again.');
        } else {
            this.showErrorBanner('Could not start recording. Please check permissions and try again.');
        }
    }

    showSuccessBanner(message) {
        console.log('Success:', message);
        this.showBanner(message, 'success');
    }
    
    showErrorBanner(message) {
        this.showBanner(message, 'error');
    }
    
    showInfoBanner(message) {
        this.showBanner(message, 'info');
    }
    
    showBanner(message, type = 'info') {
        
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.className = `info-banner ${type}`;
        this.elements.errorMessage.style.display = 'block';
        this.elements.errorMessage.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-hide success/info messages after BANNER_DURATION seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => this.hideBanner(), CONFIG.UI.BANNER_DURATION);
        }
    }
    
    hideBanner() {
        this.elements.errorMessage.style.display = 'none';
    }

    // =============================================================================
    // UTILITY METHODS
    // =============================================================================
    getSupportedMimeType() {
        const supportedFormats = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/ogg'
        ];
        
        for (const format of supportedFormats) {
            if (MediaRecorder.isTypeSupported(format)) {
                return format;
            }
        }
        return 'audio/mp4'; // iOS Safari fallback
    }

    getFileExtension() {
        const mimeType = this.recorder.mimeType || this.getSupportedMimeType();
        
        if (mimeType.includes('webm')) return '.webm';
        if (mimeType.includes('mp4')) return '.mp4';
        if (mimeType.includes('ogg')) return '.ogg';
        
        return '.webm';
    }

    // =============================================================================
    // CLEANUP METHODS
    // =============================================================================

    cleanupAudioStream() {
        if (this.recorder.audioStream) {
            this.recorder.audioStream.getTracks().forEach(track => track.stop());
            this.recorder.audioStream = null;
        }
    }

    cleanupAudioContext() {
        if (this.audio.context) {
            this.audio.context.close();
            this.audio.context = null;
        }
    }


    async updateDatabaseStatus() {
        try {
            if (window.parkinsonApp?.updateDatabaseStatus) {
                await window.parkinsonApp.updateDatabaseStatus();
            }
        } catch (error) {
            console.error('Error updating database status:', error);
        }
    }

    // =============================================================================
    // PUBLIC API METHODS
    // =============================================================================

    hasRecording() {
        return this.state.hasRecording && this.recorder.recordingBlob !== null;
    }

    getRecordingData() {
        if (!this.hasRecording()) {
            return null;
        }
        
        return {
            blob: this.recorder.recordingBlob,
            duration: this.timer.totalDuration,
            formattedDuration: this.formatDuration(this.timer.totalDuration),
            mimeType: this.recorder.mimeType,
            fileSize: this.recorder.recordingBlob.size
        };
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}