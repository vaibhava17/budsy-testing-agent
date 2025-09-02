# Budsy Setup Guide 🚀

Quick setup guide for getting Budsy running with the web interface.

## Prerequisites Checklist ✅

### 1. Node.js & NPM
```bash
# Check versions
node --version  # Should be >= 18.0.0
npm --version
```

### 2. Chrome Browser
Make sure Chrome is installed and accessible from command line:
```bash
# Test Chrome availability
google-chrome --version
# or on macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version
```

### 3. Backend Service
Your Hortiprise backend should be running with the UI verification module:
- ✅ Backend accessible at `http://localhost:8000` (or your configured URL)
- ✅ API authentication key configured  
- ✅ Gemini API key set for vision capabilities

## Quick Start 🎯

### 1. Install Dependencies
```bash
cd budsy-testing-agent
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` file:
```env
# Backend LLM Service
BACKEND_URL=http://localhost:8000
API_AUTH_KEY=your-backend-auth-key-here

# Appium Server (optional for web testing)
APPIUM_SERVER_URL=http://localhost:4723

# Browser Configuration
DEFAULT_BROWSER=chrome
SAVE_SCREENSHOTS=true
```

### 3. Start Web Interface
```bash
npm run web
```

Open `http://localhost:3000` in your browser! 🌐

## Testing the Setup

### Quick Health Check
```bash
npm run start health
```

This will check:
- ✅ AI Backend connection
- ✅ Appium server (if configured)
- ✅ System configuration

### Run Your First Test

1. **Open Web Interface**: `http://localhost:3000`
2. **Enter Test Instruction**: "Navigate to Google.com and verify the search box is visible"
3. **Set URL**: `https://www.google.com`
4. **Click "Start Test"** and watch live execution! 

## Troubleshooting 🔧

### Common Issues & Solutions

**❌ "Backend Connection Error"**
```bash
# Check if your backend is running
curl http://localhost:8000/health

# Check your API key in .env file
cat .env | grep API_AUTH_KEY
```

**❌ "Chrome Driver Issues"**
```bash
# Chrome should be installed and accessible
google-chrome --version

# For macOS, ensure Chrome is in Applications
ls "/Applications/Google Chrome.app"
```

**❌ "Cannot connect to Appium"**
- This is OK for web testing! Budsy will use direct WebDriverIO
- For mobile testing, install and start Appium:
```bash
npm install -g appium
appium driver install uiautomator2  # For Android
appium server --port 4723
```

### Web Interface Not Loading?

1. **Check port availability**:
```bash
lsof -i :3000  # Should be empty or show Budsy server
```

2. **Try different port**:
```bash
npm run web -- --port 4000
```

3. **Check browser console** for JavaScript errors

### Log Analysis

All logs are available in:
- **Console**: Real-time logs in web interface
- **File**: `./logs/budsy.log`
- **Download**: Automatic on test failures

## For Developers 👨‍💻

### Development Mode
```bash
# Auto-reload web interface
npm run web:dev

# Auto-reload CLI
npm run dev
```

### Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Interface │    │  Budsy Agent    │    │  Backend LLM    │
│  (Browser UI)   │◄──►│   (Node.js)     │◄──►│   (Python)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                       ┌─────────────────┐
                       │ WebDriverIO     │
                       │ (Browser Auto)  │
                       └─────────────────┘
```

### Adding Custom Tests
```javascript
// src/examples/my-custom-test.js
import TestExecutor from '../core/test-executor.js';

const executor = new TestExecutor();
await executor.initialize({ platform: 'web' });

const result = await executor.executeWithVerification(
  "Your test instruction here",
  "https://your-site.com"
);
```

## Advanced Configuration ⚙️

### Custom Capabilities
Edit `src/config/index.js`:
```javascript
webCapabilities: {
  browserName: 'firefox',  // Use Firefox instead
  'moz:firefoxOptions': {
    args: ['--headless']   // Run headless
  }
}
```

### Mobile Testing Setup
```bash
# Install Appium and drivers
npm install -g appium
appium driver install uiautomator2  # Android
appium driver install xcuitest      # iOS

# Start Appium server
appium server --port 4723

# Configure mobile capabilities in config/index.js
```

## Support & Resources 📚

- **Logs**: Check `./logs/budsy.log` for detailed information
- **Screenshots**: Available in `./screenshots/` directory
- **Examples**: See `src/examples/` for test examples
- **Issues**: Report bugs or feature requests in GitHub

---

**🎉 You're ready to start testing with Budsy!**

Try the web interface first - it's the easiest way to get started and provides real-time feedback on test execution.