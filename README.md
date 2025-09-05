# Parkinson Web Test Application

A web-based testing platform designed for Parkinson's patients to assess and monitor cognitive, motor, and speech functions using everyday devices.

## Overview

This application provides a modular, database-enabled platform for conducting voice recording assessments with patient management capabilities. It leverages browser-based sensor access to deliver interactive tests tailored to individual patients, enabling remote assessment and long-term monitoring of disease progression.

## Features

### Core Functionality
- **Patient Management**: Create, search, and manage patient records with unique IDs
- **Voice Recording**: High-quality audio capture with pause/resume functionality
- **Database Storage**: Local IndexedDB storage for patients and recordings
- **Real-time Visualization**: Audio level monitoring and recording duration tracking
- **Export Capabilities**: Download recordings and export database data

### Technical Features
- **Modular Architecture**: Separated concerns for easy maintenance and extension
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Browser Compatibility**: Supports modern browsers with fallback handling
- **Accessibility**: Keyboard navigation and screen reader support
- **Offline Capability**: Works without internet connection

## Installation

### Prerequisites
- Node.js 18+ (verify with `node -v`)
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Microphone access permissions

### Setup
1. Install dependencies:
```bash
npm install
```
2. Start the server (LAN-enabled):
```bash
npm start
```
3. The terminal will display two URLs, e.g.:
   - Local: `http://localhost:3000`
   - Network: `http://192.168.1.25:3000`

Open the Network URL on your phone (connected to the same Wi‑Fi) to test on mobile. If it doesn't load:
- Ensure your phone and PC are on the same network
- Temporarily allow Node.js through Windows Defender Firewall
- Avoid corporate/VPN networks that isolate devices

For auto-reload during development (server restarts on file changes):
```bash
npm run dev
```

## Usage

### Patient Management
1. **Search Existing Patient**: Enter Patient ID and click "Search Patient"
2. **Create New Patient**: Fill out the patient form with required information
   - First Name (2-50 characters)
   - Last Name (2-50 characters)
   - Date of Birth (18-120 years)
   - Gender selection

### Voice Recording
1. **Select Patient**: Choose existing patient or create new one
2. **Proceed to Recording**: Click the Proceed button in Current Patient panel
3. **Start Recording**: Click "Start Recording" button
4. **Control Recording**: Use Pause, Resume, and Stop controls as needed
5. **Save Recording**: Store in database or download locally
6. **Review**: Play back recordings and view metadata

### Database Operations
- **Automatic Storage**: Recordings automatically associated with patient IDs
- **Data Export**: Export patient and recording data as JSON (via console utils)
- **Statistics**: View database usage and storage information
- **Data Management**: Clear database or export for backup

## Architecture

### Module Structure
```
js/
├── config.js          # Configuration and constants
├── database.js        # IndexedDB management and operations
├── patient-manager.js # Patient CRUD operations and validation
├── voice-recorder.js  # Audio recording and processing
└── app.js            # Main application coordination
```

### Server
- `server.js`: Express server serving static files (LAN enabled)
- `package.json`: Start scripts (`npm start`, `npm run dev`)

### Database Schema
- **Patients Table**: ID, firstName, lastName, dateOfBirth, gender, createdAt, updatedAt
- **Recordings Table**: ID, patientId, dateTime, audioBlob, duration, mimeType, fileSize

## Configuration

### Settings (`js/config.js`)
- Database name and version
- Validation rules (name length, age limits)
- Recording parameters (chunk interval, supported formats)
- UI timing and animation settings

### Customization
- Modify `CONFIG` object to adjust application behavior
- Add new audio formats in `RECORDING.SUPPORTED_FORMATS`
- Adjust validation rules in `VALIDATION` section
- Update UI timing in `UI` section

## Development

- Start server: `npm start`
- Dev server with restart on change: `npm run dev`
- Access on phone: use the Network URL printed in the terminal

Debug console helpers:
```javascript
window.utils.exportDatabase()
window.utils.getDatabaseStats()
window.patientManager
window.voiceRecorder
window.db
```

## Data Management & Privacy
- Data stored locally in IndexedDB in the browser
- No data is sent to external servers
- Use export utilities to back up data

## Troubleshooting
- If mobile can’t access: same Wi‑Fi, firewall rules for Node.js, avoid VPNs
- Mic permission denied: enable permissions in browser settings and refresh
- Database errors: clear site data in browser and retry

## License
This project is developed for research and clinical use. Ensure compliance with relevant healthcare data protection regulations.

