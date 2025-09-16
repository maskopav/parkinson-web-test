const express = require('express');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS (optional, helpful for local dev)
app.use(cors());

// Serve static files from project root
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(path.join(__dirname, 'src'), 'index.html'));
});

// Helper to get local IPs for instructions
function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }
    return addresses;
}

app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log(`Server running on:`);
    console.log(`- Local:   http://localhost:${PORT}`);
    ips.forEach(ip => console.log(`- Network: http://${ip}:${PORT}`));
    console.log('Open the Network URL on your phone (same Wi‑Fi) to test.');
});
