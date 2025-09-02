# Budsy Testing Agent 🤖

**AI-powered UI testing agent using Appium with screenshot verification**

Budsy combines the power of Appium automation with AI vision capabilities to create intelligent UI tests using natural language instructions. Just tell Budsy what you want to test, and it will generate the steps, execute them, and verify the results using AI-powered screenshot analysis.

## Features ✨

- **Natural Language Testing**: Write tests in plain English
- **AI-Powered Verification**: Screenshots analyzed by AI for accurate validation
- **Multi-Platform Support**: Web browsers, Android, and iOS
- **Smart Step Generation**: Automatically converts instructions to executable steps
- **Web Interface**: Modern web UI with real-time logs and results
- **Live Log Streaming**: Watch test execution in real-time via WebSocket
- **Automatic Log Extraction**: Instant log downloads when tests fail
- **Visual Documentation**: Screenshots saved for each step
- **Detailed Logging**: Comprehensive test execution logs
- **Interactive CLI**: User-friendly command-line interface

## Prerequisites 📋

### 1. Backend LLM Service
Ensure your Hortiprise backend is running with the UI verification module:
- Backend should be accessible at the configured URL
- API authentication key configured
- Gemini API key set for vision capabilities

### 2. Appium Server
Install and start Appium server:

```bash
# Install Appium globally
npm install -g appium

# Install drivers
appium driver install uiautomator2  # For Android
appium driver install xcuitest      # For iOS

# Start Appium server
appium server --port 4723
```

### 3. Browser/Mobile Setup

**For Web Testing:**
- Chrome browser installed
- ChromeDriver available in PATH

**For Android Testing:**
- Android SDK installed
- Device/emulator connected and authorized
- USB debugging enabled

**For iOS Testing:**
- Xcode installed (macOS only)
- iOS Simulator or physical device connected
- WebDriverAgent configured

## Installation 🚀

1. **Clone and install dependencies:**
```bash
cd budsy-testing-agent
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` file:
```env
# Backend LLM Service
BACKEND_URL=http://localhost:8000
API_AUTH_KEY=your-backend-auth-key-here

# Appium Server
APPIUM_SERVER_URL=http://localhost:4723

# Other configurations...
```

3. **Verify setup:**
```bash
npm run start health
```

## Quick Start 🎯

### 🌐 Web Interface (Recommended)
```bash
# Start the web interface
npm run web

# Or specify custom port
npm run web -- --port 4000
```
Then open `http://localhost:3000` in your browser for the modern web interface with:
- ✅ Real-time test execution logs
- 📊 Live test progress and results
- 📥 Automatic log downloads on failures
- 🖼️ Screenshot viewing and management

### 💻 Interactive CLI Mode
```bash
npm start
```
This launches an interactive wizard that guides you through setting up and running tests.

### ⚡ Command Line Mode
```bash
# Web test
npm run start run --platform web --url "https://example.com" --instruction "Click login button and verify login form appears"

# Android test  
npm run start run --platform android --app "/path/to/app.apk" --instruction "Open app, navigate to settings, and verify dark mode toggle"

# iOS test
npm run start run --platform ios --app "com.example.app" --instruction "Launch app and verify welcome screen is displayed"
```

## Usage Examples 📖

### Basic Web Test
```javascript
import TestExecutor from './src/core/test-executor.js';

const executor = new TestExecutor();

// Initialize for web testing
await executor.initialize({
  platform: 'web',
  driver: {
    capabilities: { browserName: 'chrome' }
  }
});

// Execute test with AI verification
const result = await executor.executeWithVerification(
  "Navigate to login page, enter credentials, and verify dashboard loads",
  "https://myapp.com/login",
  {
    expectedResult: "User should be logged in and see the dashboard",
    context: { testType: "login_flow" }
  }
);

console.log(`Test ${result.verification.success ? 'PASSED' : 'FAILED'}`);
console.log(`Confidence: ${result.verification.confidence * 100}%`);
```

### Natural Language Instructions

Budsy understands natural language instructions like:

- **Navigation**: "Navigate to the homepage"
- **Form Input**: "Fill in email field with 'user@example.com'"
- **Interactions**: "Click the submit button"
- **Verification**: "Verify that success message is displayed"
- **Complex Flows**: "Login with email 'test@test.com' and password '123456', then go to profile page and update the phone number to '+1234567890'"

### Advanced Features

**Custom Context:**
```bash
npm run start run --instruction "Test checkout flow" --expected "Order confirmation displayed" --platform web --url "https://shop.com"
```

**Screenshot Management:**
```bash
# Disable screenshot saving
npm run start run --no-screenshots --instruction "Quick smoke test"
```

**Mobile Testing:**
```bash
# Android APK
npm run start run --platform android --app "/path/to/app.apk" --instruction "Complete user onboarding"

# Android package name
npm run start run --platform android --app "com.example.myapp" --instruction "Test shopping cart functionality"

# iOS app
npm run start run --platform ios --app "MyApp.app" --instruction "Verify push notification settings"
```

## Configuration ⚙️

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BACKEND_URL` | LLM backend service URL | `http://localhost:8000` |
| `API_AUTH_KEY` | Backend authentication key | - |
| `APPIUM_SERVER_URL` | Appium server endpoint | `http://localhost:4723` |
| `DEFAULT_BROWSER` | Browser for web testing | `chrome` |
| `SCREENSHOT_DIR` | Screenshot storage directory | `./screenshots` |
| `DEFAULT_TIMEOUT` | Element wait timeout (ms) | `10000` |
| `STEP_DELAY` | Delay between steps (ms) | `1000` |
| `LOG_LEVEL` | Logging level | `info` |

### Appium Capabilities

**Web Testing:**
```javascript
{
  browserName: 'chrome',
  'goog:chromeOptions': {
    args: ['--disable-web-security', '--no-sandbox']
  }
}
```

**Android Testing:**
```javascript
{
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:app': '/path/to/app.apk',
  'appium:newCommandTimeout': 300
}
```

**iOS Testing:**
```javascript
{
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:app': '/path/to/MyApp.app',
  'appium:newCommandTimeout': 300
}
```

## API Reference 📚

### TestExecutor

Main class for executing AI-powered tests.

```javascript
const executor = new TestExecutor();

// Initialize with platform
await executor.initialize(options);

// Execute instruction with AI verification
const result = await executor.executeWithVerification(
  instruction,
  url_or_app,
  options
);

// Get test summary
const summary = executor.getTestSummary();

// Cleanup resources
await executor.cleanup();
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `platform` | string | 'web', 'android', 'ios' |
| `driver.capabilities` | object | Appium capabilities |
| `expectedResult` | string | Expected outcome description |
| `context` | object | Additional context for AI |
| `screenshotBeforeStep` | boolean | Take screenshot before each step |

## File Structure 📁

```
budsy-testing-agent/
├── src/
│   ├── core/
│   │   ├── ai-client.js          # Backend LLM service client
│   │   ├── appium-driver.js      # Appium WebDriver manager
│   │   ├── logger.js             # Centralized logging
│   │   └── test-executor.js      # Main test execution engine
│   ├── config/
│   │   └── index.js              # Configuration management
│   ├── examples/
│   │   └── basic-web-test.js     # Example test scripts
│   └── index.js                  # CLI interface
├── screenshots/                   # Generated screenshots
├── logs/                         # Test execution logs
├── package.json
├── .env.example
└── README.md
```

## CLI Commands 💻

| Command | Description |
|---------|-------------|
| `npm run web` | **🌐 Start web interface (port 3000)** |
| `npm run web:dev` | Development web interface with auto-reload |
| `npm start` | Interactive test mode |
| `npm run start test` | Interactive mode (explicit) |
| `npm run start run [options]` | Command line mode |
| `npm run start web [--port] [--host]` | Start web interface with custom port/host |
| `npm run start config` | Show current configuration |
| `npm run start health` | Health check all services |
| `npm run dev` | Development mode with file watching |
| `npm test` | Run example tests |

### 🌐 Web Interface Features

The web interface (`npm run web`) provides:

- **Real-time Test Execution**: Watch your tests run live with streaming logs
- **Visual Test Configuration**: Easy-to-use forms for setting up tests
- **Live Log Display**: Color-coded logs with timestamps and component information
- **Automatic Failure Handling**: Instant log download when tests fail or encounter errors
- **Test Result Analytics**: Detailed results with AI confidence scores and screenshots
- **System Health Monitoring**: Real-time status of backend and Appium services
- **Screenshot Gallery**: View captured screenshots from test execution
- **Multiple Test Management**: Track and manage multiple test sessions

## Troubleshooting 🔧

### Common Issues

**Backend Connection Error:**
```
Error: AI verification failed: connect ECONNREFUSED
```
- Ensure backend is running at configured URL
- Check `API_AUTH_KEY` is correct
- Verify backend has UI verification module enabled

**Appium Connection Error:**
```
Error: Driver initialization failed: connect ECONNREFUSED localhost:4723
```
- Start Appium server: `appium server --port 4723`
- Check Appium server URL in configuration
- Ensure required drivers are installed

**Element Not Found:**
```
Error: Element not found: #submit-button
```
- Verify element selectors are correct
- Check if element is loaded (add wait time)
- Try different locator strategies (ID, class, XPath)

**AI Verification Failed:**
```
Error: Step verification failed: Could not confirm expected result
```
- Review screenshot in output directory
- Adjust expected result description
- Check if UI matches instruction

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

### Screenshot Analysis

Screenshots are saved in the configured directory:
- Before/after each step
- Verification screenshots
- Final result screenshots

Review these to understand test execution and AI analysis.

## Contributing 🤝

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Happy Testing with Budsy! 🤖✨**

For more information, visit the [Hortiprise GitHub repository](https://github.com/hortiprise/hortiprise) or contact our support team.