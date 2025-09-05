// Patient management module
class PatientManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.currentPatient = null;
        
        // DOM elements
        this.patientSection = document.getElementById('patient-section');
        this.recordingSection = document.getElementById('recording-section');
        this.patientIdInput = document.getElementById('patient-id');
        this.searchPatientBtn = document.getElementById('search-patient-btn');
        this.firstNameInput = document.getElementById('first-name');
        this.lastNameInput = document.getElementById('last-name');
        this.dateOfBirthInput = document.getElementById('date-of-birth');
        this.genderSelect = document.getElementById('gender');
        this.savePatientBtn = document.getElementById('save-patient-btn');
        this.patientInfoDisplay = document.getElementById('patient-info-display');
        this.patientDetails = document.getElementById('patient-details');
        this.updatePatientBtn = document.getElementById('update-patient-btn');
        
        // Internal state for edit mode
        this.isEditing = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.setDefaultDate();
    }

    bindEvents() {
        if (this.searchPatientBtn) {
            this.searchPatientBtn.addEventListener('click', () => this.onSearchClicked());
        }
        if (this.savePatientBtn) {
            this.savePatientBtn.addEventListener('click', () => this.onSaveClicked());
        }
        if (this.updatePatientBtn) {
            this.updatePatientBtn.addEventListener('click', () => this.onUpdateClicked());
        }
        
        // Enter key support for patient ID search
        if (this.patientIdInput) {
            this.patientIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.onSearchClicked();
                }
            });
        }
    }

    // Handlers
    async onSearchClicked() {
        if (window.db && window.db.readyPromise) {
            try { await window.db.readyPromise; }
            catch (e) { return this.showErrorBanner('Database is not ready. Please refresh.'); }
        }
        const patientId = (this.patientIdInput?.value || '').trim();
        if (!patientId) {
            return this.showErrorBanner('Please enter a Patient ID');
        }
        try {
            const patient = await this.db.getPatient(patientId);
            if (patient === undefined || patient === null) {
                return this.showErrorBanner(`No patient found with ID: ${patientId}`);
            }
            await this.handlePatientFound(patient);
        } catch (error) {
            console.error('Error searching for patient:', error);
            this.showErrorBanner('Error searching for patient. Please try again.');
        }
    }

    async onSaveClicked() {
        if (!this.validatePatientForm()) {
            return;
        }
        const formData = this.collectFormData();
        try {
            // If editing an existing patient, update; otherwise create new
            if (this.isEditing && this.currentPatient) {
                const updated = { ...this.currentPatient, ...formData };
                await this.db.updatePatient(updated);
                const reloaded = await this.db.getPatient(this.currentPatient.id);
                await this.handlePatientFound(reloaded, { showSavedToast: true });
                this.isEditing = false;
            } else {
                const newId = await this.db.addPatient(formData);
                const newPatient = await this.db.getPatient(newId);
                await this.handlePatientFound(newPatient, { showSavedToast: true });
            }
            this.clearForm();
        } catch (error) {
            console.error('Error saving patient:', error);
            this.showErrorBanner('Error saving patient. Please try again.');
        }
    }

    onUpdateClicked() {
        if (!this.currentPatient) {
            return this.showErrorBanner('No patient selected to update.');
        }
        this.isEditing = true;
        this.populateForm(this.currentPatient);
        this.enableForm();
        
        // Show form and hide patient display
        this.showForm();
        this.hidePatientDisplay();
        
        // Inform user
        this.showInfoBanner('Editing personal information. Save to apply changes.');
        
        // Focus first field
        if (this.firstNameInput) {
            this.firstNameInput.focus();
        }
        
        this.scrollFormIntoView();
    }
    
    onNewPatientClicked() {
        this.currentPatient = null;
        this.isEditing = false;
        
        // Hide patient display and recording section
        this.hidePatientDisplay();
        if (this.recordingSection) {
            this.recordingSection.style.display = 'none';
        }
        
        // Show form and reset state
        this.showForm();
        this.patientSection.classList.remove('patient-selected');
        this.clearForm();
        if (this.patientIdInput) this.patientIdInput.value = '';
        this.hideBanner();
        this.enableForm();
        this.showInfoBanner('Enter new patient data');
    }

    // Core flows
    async handlePatientFound(patient, options = {}) {
        this.currentPatient = patient;
        this.showPatientInfo(patient);
        this.disableForm();
        
        // Hide form and show action panel
        this.hideForm();
        this.showPatientDisplay();
        
        // Show appropriate success message
        const message = options.showSavedToast
            ? 'Patient was successfully saved to the database.'
            : 'Patient was found in the database.';
        this.showSuccessBanner(message);
        
        // Wait for explicit proceed
        this.attachProceedHandlerOnce();
        this.attachChangeHandlerOnce();
    }

    attachProceedHandlerOnce() {
        const proceedBtn = document.getElementById('proceed-btn');
        if (!proceedBtn) return;
        if (this._proceedBound) return;
        proceedBtn.addEventListener('click', () => {
            this.showRecordingSection();
        });
        this._proceedBound = true;
    }

    attachChangeHandlerOnce() {
        const changeBtn = document.getElementById('change-patient-btn');
        if (!changeBtn) return;
        if (this._changeBound) return;
        changeBtn.addEventListener('click', () => {
            // Reset view to allow selecting/creating another patient
            this.onNewPatientClicked();
            const wrapper = document.getElementById('patient-form-wrapper');
            if (wrapper) wrapper.style.display = 'block';
        });
        this._changeBound = true;
    }

    // Utilities
    collectFormData() {
        return {
            firstName: this.firstNameInput.value.trim(),
            lastName: this.lastNameInput.value.trim(),
            dateOfBirth: this.dateOfBirthInput.value,
            gender: this.genderSelect.value
        };
    }

    populateForm(patient) {
        this.firstNameInput.value = patient.firstName || '';
        this.lastNameInput.value = patient.lastName || '';
        this.dateOfBirthInput.value = patient.dateOfBirth || '';
        this.genderSelect.value = patient.gender || '';
    }

    enableForm() {
        this.firstNameInput.disabled = false;
        this.lastNameInput.disabled = false;
        this.dateOfBirthInput.disabled = false;
        this.genderSelect.disabled = false;
        this.savePatientBtn.textContent = this.isEditing ? 'Update Patient Information' : 'Save Patient Information';
    }

    disableForm() {
        this.firstNameInput.disabled = true;
        this.lastNameInput.disabled = true;
        this.dateOfBirthInput.disabled = true;
        this.genderSelect.disabled = true;
        this.savePatientBtn.textContent = 'Save Patient Information';
    }

    scrollFormIntoView() {
        this.patientSection.scrollIntoView({ behavior: 'smooth' });
    }

    setDefaultDate() {
        // Default to an adult date to aid selection
        const today = new Date();
        const defaultDate = new Date(today.getFullYear() - 40, 0, 1);
        this.dateOfBirthInput.value = defaultDate.toISOString().split('T')[0];
    }

    // Validation
    validatePatientForm() {
        const { firstName, lastName, dateOfBirth, gender } = this.collectFormData();
        this.clearValidationErrors();
        let isValid = true;

        if (firstName.length < CONFIG.VALIDATION.MIN_NAME_LENGTH) {
            this.showFieldError(this.firstNameInput, `First name must be at least ${CONFIG.VALIDATION.MIN_NAME_LENGTH} characters`);
            isValid = false;
        } else if (firstName.length > CONFIG.VALIDATION.MAX_NAME_LENGTH) {
            this.showFieldError(this.firstNameInput, `First name must be no more than ${CONFIG.VALIDATION.MAX_NAME_LENGTH} characters`);
            isValid = false;
        }

        if (lastName.length < CONFIG.VALIDATION.MIN_NAME_LENGTH) {
            this.showFieldError(this.lastNameInput, `Last name must be at least ${CONFIG.VALIDATION.MIN_NAME_LENGTH} characters`);
            isValid = false;
        } else if (lastName.length > CONFIG.VALIDATION.MAX_NAME_LENGTH) {
            this.showFieldError(this.lastNameInput, `Last name must be no more than ${CONFIG.VALIDATION.MAX_NAME_LENGTH} characters`);
            isValid = false;
        }

        if (!dateOfBirth) {
            this.showFieldError(this.dateOfBirthInput, 'Date of birth is required');
            isValid = false;
        } else {
            const birthDate = new Date(dateOfBirth);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < CONFIG.VALIDATION.MIN_AGE) {
                this.showFieldError(this.dateOfBirthInput, `Patient must be at least ${CONFIG.VALIDATION.MIN_AGE} years old`);
                isValid = false;
            } else if (age > CONFIG.VALIDATION.MAX_AGE) {
                this.showFieldError(this.dateOfBirthInput, `Patient age cannot exceed ${CONFIG.VALIDATION.MAX_AGE} years`);
                isValid = false;
            }
        }

        if (!gender) {
            this.showFieldError(this.genderSelect, 'Gender selection is required');
            isValid = false;
        }

        return isValid;
    }

    showFieldError(field, message) {
        field.classList.add('error');
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.textContent = message;
        field.parentNode.appendChild(errorElement);
    }

    clearValidationErrors() {
        const fields = [this.firstNameInput, this.lastNameInput, this.dateOfBirthInput, this.genderSelect];
        fields.forEach(field => field.classList.remove('error'));
        const errorMessages = document.querySelectorAll('.field-error');
        errorMessages.forEach(msg => msg.remove());
    }

    // UI updates
    showPatientInfo(patient) {
        const detailsContent = document.getElementById('patient-details-content');
        if (!detailsContent) return;
    
        detailsContent.innerHTML = `
            <div class="patient-info-grid">
                <div class="info-item"><strong>ID:</strong> ${patient.id}</div>
                <div class="info-item"><strong>Name:</strong> ${patient.firstName} ${patient.lastName}</div>
                <div class="info-item"><strong>Date of Birth:</strong> ${new Date(patient.dateOfBirth).toLocaleDateString()}</div>
                <div class="info-item"><strong>Gender:</strong> ${patient.gender}</div>
                <div class="info-item"><strong>Created:</strong> ${new Date(patient.createdAt).toLocaleDateString()}</div>
                ${patient.updatedAt ? `<div class="info-item"><strong>Updated:</strong> ${new Date(patient.updatedAt).toLocaleDateString()}</div>` : ''}
            </div>
        `;
        if (this.patientInfoDisplay) {
            this.patientInfoDisplay.style.display = 'block';
        }
        this.patientSection.classList.add('patient-selected');
    }

    showRecordingSection() {
        this.recordingSection.style.display = 'block';
        this.recordingSection.scrollIntoView({ behavior: 'smooth' });
    }

    // ==========================================================================
    // BANNER MANAGEMENT - Centralized banner system
    // ==========================================================================
    
    showSuccessBanner(message) {
        this.showBanner(message, 'success');
    }
    
    showErrorBanner(message) {
        this.showBanner(message, 'error');
    }
    
    showInfoBanner(message) {
        this.showBanner(message, 'info');
    }
    
    showBanner(message, type = 'info') {
        const banner = document.getElementById('patient-message');
        if (!banner) {
            console.error('Banner element not found!');
            return;
        }
        
        banner.textContent = message;
        banner.className = `info-banner ${type}`;
        banner.style.display = 'block';
        banner.scrollIntoView({ behavior: 'smooth' });
        
        // Auto-hide success/info messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => this.hideBanner(), 5000);
        }
    }
    
    hideBanner() {
        const banner = document.getElementById('patient-message');
        if (banner) {
            banner.style.display = 'none';
        }
    }
    
    // ==========================================================================
    // UI STATE MANAGEMENT - Clean form/display state handling
    // ==========================================================================
    
    hideForm() {
        const wrapper = document.getElementById('patient-form-wrapper');
        if (wrapper) {
            wrapper.style.display = 'none';
        }
    }
    
    showForm() {
        const wrapper = document.getElementById('patient-form-wrapper');
        if (wrapper) {
            wrapper.style.display = 'block';
        }
    }
    
    showPatientDisplay() {
        if (this.patientInfoDisplay) {
            this.patientInfoDisplay.style.display = 'block';
        }
    }
    
    hidePatientDisplay() {
        if (this.patientInfoDisplay) {
            this.patientInfoDisplay.style.display = 'none';
        }
    }
    

    hideError() {
        // Legacy method - use hideBanner() instead
        this.hideBanner();
        const errorMessage = document.getElementById('error-message');
        if (errorMessage) {
            errorMessage.style.display = 'none';
        }
    }

    clearForm() {
        this.firstNameInput.value = '';
        this.lastNameInput.value = '';
        this.dateOfBirthInput.value = '';
        this.genderSelect.value = '';
        this.setDefaultDate();
    }

    getCurrentPatient() {
        return this.currentPatient;
    }
}
