/**
 * Routing Module
 * Manages the application's single-page navigation.
 * It shows and hides different sections based on the URL's hash.
 */
class Router {
    constructor(app) {
        this.app = app;
        // Map of routes to their corresponding sections
        this.routes = {
            '#': 'patient-section', // Default route
            '#patient-manager': 'patient-section',
            '#voice-recorder': 'recording-section',
            '#clinician-dashboard': 'clinician-dashboard-section'
        };

        this.init();
    }

    init() {
        console.log('Router initialized.');
        // Listen for hash changes in the URL
        window.addEventListener('hashchange', () => this.handleRoute());
        // Handle the initial route when the page loads
        this.handleRoute();
    }

    handleRoute() {
        const hash = window.location.hash || '#';
        const sectionId = this.routes[hash];

        // Hide all sections first
        this.hideAllSections();

        // Show the correct section
        if (sectionId) {
            this.showSection(sectionId);
            console.log(`Mapsd to section: ${sectionId}`);
        } else {
            console.warn(`Route not found for hash: ${hash}`);
            this.showSection(this.routes['#']); // Show default section
        }
    }

    hideAllSections() {
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });
    }

    showSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
        }
    }
}

// Make the class available globally
window.Router = Router;