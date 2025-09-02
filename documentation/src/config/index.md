# Configuration Management

**File:** `src/config/index.js`

## Overview
Central configuration management system for the Budsy testing agent. Loads environment variables and provides structured configuration objects for all application components.

## Import Dependencies
```javascript
import dotenv from 'dotenv';                    // Environment variable loader
import path from 'path';                        // Path utilities
import { fileURLToPath } from 'url';           // URL to file path conversion
```

**Related Documentation:**
- dotenv: External dependency for environment variable management
- Built-in Node.js modules for path and URL handling

## Configuration Structure

### Backend Configuration (`config.backend`)
AI backend service configuration:
- **url** - Backend service URL (default: `http://localhost:8000`)
- **authKey** - API authentication key
- **endpoints** - API endpoint definitions:
  - `uiVerification` - `/llm/ui-verification/verify`
  - `generateSteps` - `/llm/ui-verification/generate-steps`
  - `visualAction` - `/llm/ui-verification/visual-action`
  - `startSession` - `/llm/ui-verification/start-session`
  - `iterativeFeedback` - `/llm/ui-verification/iterative-feedback`

### Appium Configuration (`config.appium`)
WebDriver and mobile automation settings:
- **serverUrl** - Appium server URL (default: `http://localhost:4723`)
- **logLevel** - Appium logging level (default: `info`)

#### Web Capabilities (`webCapabilities`)
Browser automation configuration:
- **platformName** - Set to `Desktop`
- **browserName** - Browser selection (default: `chrome`)
- **automationName** - Automation driver (`Gecko` for Firefox, `Chromium` for Chrome)
- **newCommandTimeout** - Command timeout (300 seconds)
- **Chrome Options** - Browser-specific settings:
  - Disabled web security
  - No sandbox mode
  - Disabled GPU
  - Window size configuration

#### Mobile Capabilities
- **androidCapabilities** - Android automation with UiAutomator2
- **iosCapabilities** - iOS automation with XCUITest

### Screenshot Configuration (`config.screenshots`)
Screenshot handling settings:
- **dir** - Screenshot directory (default: `./screenshots`)
- **save** - Enable/disable screenshot saving
- **quality** - Image quality (90)
- **format** - Image format (`png`)

### Testing Configuration (`config.testing`)
Test execution parameters:
- **defaultTimeout** - Default operation timeout (10000ms)
- **stepDelay** - Delay between test steps (1000ms)
- **retryAttempts** - Number of retry attempts (3)
- **waitForElementTimeout** - Element wait timeout (5000ms)

### Logging Configuration (`config.logging`)
Logging system settings:
- **level** - Log level (default: `info`)
- **file** - Log file path (default: `./logs/budsy.log`)
- **console** - Enable console output (true)

### Path Configuration (`config.paths`)
Resolved path locations:
- **root** - Project root directory
- **screenshots** - Screenshots directory path
- **logs** - Logs directory path
- **examples** - Examples directory path

## Environment Variables

### Backend Variables
- `BACKEND_URL` - AI backend service URL
- `API_AUTH_KEY` - Backend authentication key

### Appium Variables
- `APPIUM_SERVER_URL` - Appium server URL
- `APPIUM_LOG_LEVEL` - Logging level

### Browser Variables
- `DEFAULT_BROWSER` - Default browser choice
- `BROWSER_WINDOW_WIDTH` - Browser window width
- `BROWSER_WINDOW_HEIGHT` - Browser window height

### Screenshot Variables
- `SCREENSHOT_DIR` - Screenshot storage directory
- `SAVE_SCREENSHOTS` - Enable screenshot saving (`true`/`false`)

### Testing Variables
- `DEFAULT_TIMEOUT` - Default timeout value
- `STEP_DELAY` - Step execution delay

### Logging Variables
- `LOG_LEVEL` - Logging level (`error`, `warn`, `info`, `debug`)
- `LOG_FILE` - Log file location

## Usage Examples
```javascript
import config from './config/index.js';

// Access backend configuration
const backendUrl = config.backend.url;
const apiKey = config.backend.authKey;

// Access Appium settings
const appiumServer = config.appium.serverUrl;
const webCaps = config.appium.webCapabilities;

// Access paths
const screenshotDir = config.paths.screenshots;
```

## Related Files
- **AI Client:** `src/core/ai-client.js` (see [AI Client Documentation](../core/ai-client.md))
- **Appium Driver:** `src/core/appium-driver.js` (see [Appium Driver Documentation](../core/appium-driver.md))
- **Logger:** `src/core/logger.js` (see [Logger Documentation](../core/logger.md))
- **Setup Script:** `scripts/setup.js` (see [Setup Documentation](../../scripts/setup.md))
- **Web Server:** `src/web/server.js` (see [Web Server Documentation](../web/server.md))

## Default Values
All configuration options have sensible defaults to enable quick setup:
- Local backend and Appium servers
- Chrome browser with standard window size
- Screenshot saving enabled
- Info-level logging
- Standard timeout values

## Environment Loading
Uses dotenv to automatically load `.env` file from project root, making configuration management simple and secure for different environments.