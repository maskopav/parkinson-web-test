/**
 * Clinician Dashboard Module
 * Manages the clinician-facing interface for creating test assignments.
 */
class ClinicianDashboard {
    constructor(patientManager, testManager) {
        this.patientManager = patientManager;
        this.testManager = testManager;
        
        this.elements = {
            patientSelect: document.getElementById('dashboard-patient-select'),
            testsList: document.getElementById('dashboard-tests-list'),
            createLinkBtn: document.getElementById('create-link-btn'),
            generatedLink: document.getElementById('generated-link'),
            linkContainer: document.getElementById('link-container'),
            linkInput: document.getElementById('link-input'),
            copyLinkBtn: document.getElementById('copy-link-btn')
        };
        
        this.init();
    }
    
    async init() {
        console.log("ClinicianDashboard module is loaded.");
        await this.populatePatients();
        this.populateTests();
        this.bindEvents();
    }

    async populatePatients() {
        try {
            const patients = await this.patientManager.getAllPatients();
            if (!patients || patients.length === 0) {
                console.warn('No patients found. Please create a patient first.');
                const option = document.createElement('option');
                option.textContent = 'No patients found';
                this.elements.patientSelect.appendChild(option);
                this.elements.patientSelect.disabled = true;
                return;
            }
            patients.forEach(patient => {
                const option = document.createElement('option');
                option.value = patient.id;
                option.textContent = `${patient.firstName} ${patient.lastName} (ID: ${patient.id})`;
                this.elements.patientSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to populate patients:', error);
        }
    }

    populateTests() {
        const tests = this.testManager.getAllTests();
        if (!tests || tests.length === 0) {
            console.warn('No tests found in the registry.');
            this.elements.testsList.innerHTML = '<p>No tests available to assign.</p>';
            return;
        }
        
        this.elements.testsList.innerHTML = '';
        tests.forEach(test => {
            const li = document.createElement('li');
            li.className = 'test-item';
            li.innerHTML = `
                <input type="checkbox" id="test-${test.id}" value="${test.id}">
                <label for="test-${test.id}">${test.name}</label>
                <p>${test.description}</p>
            `;
            this.elements.testsList.appendChild(li);
        });
    }

    bindEvents() {
        this.elements.createLinkBtn.addEventListener('click', async () => {
            await this.createTestAssignment();
        });
        
        this.elements.copyLinkBtn.addEventListener('click', () => {
            this.elements.linkInput.select();
            document.execCommand('copy');
            this.elements.copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.elements.copyLinkBtn.textContent = 'Copy';
            }, 2000);
        });
    }

    async createTestAssignment() {
        const patientId = this.elements.patientSelect.value;
        const selectedTests = Array.from(this.elements.testsList.querySelectorAll('input:checked'))
            .map(checkbox => checkbox.value);

        if (!patientId || selectedTests.length === 0) {
            alert('Please select a patient and at least one test.');
            return;
        }

        try {
            const assignmentId = await this.testManager.saveTestAssignment(patientId, selectedTests);
            this.displayGeneratedLink(assignmentId);
        } catch (error) {
            console.error('Failed to create test assignment:', error);
            alert('An error occurred. Failed to create the test link.');
        }
    }

    displayGeneratedLink(assignmentId) {
        const baseUrl = window.location.origin + window.location.pathname;
        const link = `${baseUrl}#test-session?id=${assignmentId}`;
        this.elements.linkInput.value = link;
        this.elements.linkContainer.style.display = 'block';
    }
}