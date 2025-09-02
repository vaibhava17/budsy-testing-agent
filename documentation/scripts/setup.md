# Budsy Setup Script

**File:** `scripts/setup.js`

## Overview
Automated setup and verification script for the Budsy testing agent. Provides interactive configuration, prerequisite checking, and environment setup.

## Import Dependencies
```javascript
import fs from 'fs/promises';           // File system operations
import path from 'path';                // Path utilities  
import { execSync } from 'child_process'; // Command execution
import inquirer from 'inquirer';        // Interactive prompts
import chalk from 'chalk';              // Terminal styling
```

**Related Documentation:**
- inquirer: External dependency for user interaction
- chalk: External dependency for terminal colors

## Main Class

### BudsySetup
Handles the complete setup process including prerequisites checking, configuration, and verification.

#### Constructor
- Sets up root directory and environment file paths
- Configures `.env` and `.env.example` file locations

#### Key Methods

##### `run()`
Main setup orchestrator that executes the complete setup sequence:
1. Displays Budsy logo and welcome message
2. Calls prerequisite checking
3. Sets up configuration
4. Creates required directories  
5. Verifies setup completion

##### `checkPrerequisites()`
Validates required software installations:
- **Node.js** (>= 18.0.0) - Required
- **NPM** - Required
- **Appium** - Required, auto-install suggested
- **Chrome Browser** - Optional, supports multiple commands

**Prerequisite Requirements:**
- Node.js version 18.0.0 or higher
- NPM package manager
- Appium server installation
- Chrome browser (optional but recommended)

##### `setupConfiguration()`
Interactive configuration setup:
- Checks for existing `.env` file
- Prompts for configuration values:
  - Backend LLM service URL (default: http://localhost:8000)
  - API authentication key (masked input)
  - Appium server URL (default: http://localhost:4723)
  - Default browser selection
  - Screenshot directory path
  - Screenshot saving preference
  - Logging level

##### `createDirectories()`
Creates required project directories:
- `screenshots/` - For test screenshots
- `logs/` - For application logs
- `temp/` - For temporary files

##### `verifySetup()`
Validates setup completion:
- Checks required files: `.env`, `package.json`, `src/index.js`, `src/config/index.js`
- Verifies required directories: `screenshots/`, `logs/`

##### `createEnvFile(config)`
Generates `.env` configuration file with:
- Backend LLM service configuration
- Appium server settings
- Browser configuration
- Screenshot settings
- Test configuration defaults
- Logging configuration

## Environment Configuration Template
```
# Backend LLM Service Configuration
BACKEND_URL=http://localhost:8000
API_AUTH_KEY=your_api_key

# Appium Configuration
APPIUM_SERVER_URL=http://localhost:4723
APPIUM_LOG_LEVEL=info

# Browser Configuration
DEFAULT_BROWSER=chrome
BROWSER_WINDOW_WIDTH=1280
BROWSER_WINDOW_HEIGHT=720

# Screenshot Configuration
SCREENSHOT_DIR=./screenshots
SAVE_SCREENSHOTS=true

# Test Configuration
DEFAULT_TIMEOUT=10000
STEP_DELAY=1000

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/budsy.log
```

## Utility Methods

##### `fileExists(filePath)` / `directoryExists(dirPath)`
Helper methods for file system validation using async/await patterns.

## Usage
Can be run directly or imported as a module:
```bash
# Direct execution
node scripts/setup.js

# Via npm script
npm run setup
```

## Related Files
- **Configuration Loader:** `src/config/index.js` (see [Configuration Documentation](../src/config/index.md))
- **Main CLI:** `src/index.js` (see [CLI Documentation](../src/index.md))
- **Package Config:** `package.json` (see [Package Documentation](../package.md))

## Exit Codes
- **0** - Setup completed successfully
- **1** - Setup failed due to missing prerequisites or errors

## Features
- Interactive CLI prompts with validation
- Prerequisite checking with helpful error messages
- Environment file generation with sensible defaults
- Directory structure creation
- Comprehensive setup verification
- Graceful error handling with descriptive messages