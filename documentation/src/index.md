# Budsy CLI - Main Entry Point

**File:** `src/index.js`

## Overview
Main CLI application for the Budsy Testing Agent. Provides command-line interface with multiple commands for test execution, configuration management, web interface, and health checking.

## Import Dependencies
```javascript
import { program } from 'commander';              // CLI framework
import inquirer from 'inquirer';                  // Interactive prompts
import chalk from 'chalk';                        // Terminal styling
import TestExecutor from './core/test-executor.js';       // Traditional test execution
import BudsyWebServer from './web/server.js';             // Web interface server
import logger from './core/logger.js';                    // Logging system
import config from './config/index.js';                   // Configuration management
```

**Related Documentation:**
- [Test Executor](./core/test-executor.md) - Traditional test execution engine
- [Web Server](./web/server.md) - Web interface server
- [Logger](./core/logger.md) - Logging system
- [Configuration](./config/index.md) - Configuration management

## Main Class

### BudsyCLI
Handles CLI operations, user interaction, and test orchestration.

#### Constructor
- Initializes TestExecutor instance
- Sets up CLI command structure

#### Properties
- **executor** - TestExecutor instance for running tests

## CLI Commands

### Interactive Mode (`budsy test`)
**Command:** `budsy test`

Launches interactive mode with guided prompts for test configuration.

**Interactive Prompts:**
1. **Platform Selection** - Web Browser, Android App, iOS App
2. **Target Configuration**:
   - **Web**: URL validation and input
   - **Mobile**: App path or package name
3. **Test Instruction** - Natural language test description (opens editor)
4. **Expected Result** - Optional outcome description
5. **Screenshot Preference** - Enable/disable screenshot saving

**Features:**
- URL validation for web testing
- App path validation for mobile testing
- Editor support for long instructions
- Default value suggestions

### Direct Test Execution (`budsy run`)
**Command:** `budsy run [options]`

Executes tests directly with command-line arguments.

**Options:**
```bash
-p, --platform <platform>    Platform: web, android, ios (default: "web")
-u, --url <url>              URL for web testing
-a, --app <path>             App path for mobile testing
-i, --instruction <text>     Test instruction (required)
-e, --expected <text>        Expected result description
--no-screenshots             Disable screenshot saving
```

**Validation:**
- Instruction is required
- URL required for web platform
- App path required for mobile platforms

**Usage Examples:**
```bash
# Web test
budsy run -p web -u "https://example.com" -i "Log into the application"

# Android test
budsy run -p android -a "/path/to/app.apk" -i "Complete user registration"

# With expected result
budsy run -u "https://app.com" -i "Search for products" -e "Product results displayed"
```

### Configuration Display (`budsy config`)
**Command:** `budsy config`

Displays current configuration settings.

**Output Sections:**
- **Backend**: URL and authentication status
- **Appium**: Server URL and log level
- **Screenshots**: Directory and save preferences
- **Testing**: Timeout and delay settings

### Web Interface (`budsy web`)
**Command:** `budsy web [options]`

Starts the Budsy web interface server.

**Options:**
```bash
-p, --port <port>    Web server port (default: 3000)
--host <host>        Web server host (default: localhost)
```

**Features:**
- Real-time test execution monitoring
- WebSocket-based logging
- Visual test result display
- Graceful shutdown handling

### Health Check (`budsy health`)
**Command:** `budsy health`

Performs comprehensive health check of all services.

**Checks:**
- **AI Backend**: Connectivity and health status
- **Appium Server**: URL configuration and accessibility

## Test Execution Methods

### `_executeTest(params)`
Core test execution method used by both interactive and direct modes.

**Parameters:**
- **platform** - Target platform
- **url** - Web testing URL
- **appPath** - Mobile app path
- **instruction** - Test instruction
- **expectedResult** - Expected outcome
- **saveScreenshots** - Screenshot preference

**Process:**
1. **Display Test Summary** - Shows configured parameters
2. **Initialize Executor** - Sets up platform-specific configuration
3. **Execute with Verification** - Runs test with AI verification
4. **Display Results** - Shows execution results and file locations

**Driver Options Configuration:**
```javascript
{
  platform: params.platform,
  driver: {
    capabilities: params.appPath ? {
      'appium:app': params.appPath,
      'appium:packageName': params.appPath
    } : {}
  }
}
```

## Result Display

### `_displayResults(result, totalDuration)`
Comprehensive result presentation with:

#### Execution Results
- Steps executed count
- Total duration
- Screenshots taken count

#### AI Verification Results
- Pass/Fail status with color coding
- Confidence percentage
- AI analysis summary (truncated to 200 chars)

#### File Locations
- Screenshot directory path
- Log file location
- Total test execution time

### `_displayTestSummary(summary)`
Test summary statistics:
- Total tests executed
- Pass/fail counts
- Success rate percentage

## Error Handling

### Interactive Mode Errors
- TTY detection for terminal compatibility
- Graceful fallback to command-line mode
- User-friendly error messages

### Execution Errors
- Comprehensive error logging
- Test summary display even on failures
- Proper resource cleanup
- Appropriate exit codes

### Validation Errors
- Required parameter checking
- Platform-specific validation
- Clear error messages with suggestions

## Configuration Integration

### Environment Variables
Integrates with configuration system for:
- Backend service URLs
- Appium server configuration
- Screenshot and logging settings
- Timeout and delay values

### Default Values
Provides sensible defaults for:
- Platform selection (web)
- Server ports (3000)
- Host binding (localhost)
- Screenshot saving (enabled)

## ASCII Branding

### BUDSY_LOGO
Displays ASCII art logo for:
- Interactive mode welcome
- Configuration display
- Web interface startup
- Health check display

```
██████╗ ██╗   ██╗██████╗ ███████╗██╗   ██╗
██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗ ██╔╝
██████╔╝██║   ██║██║  ██║███████╗ ╚████╔╝ 
██╔══██╗██║   ██║██║  ██║╚════██║  ╚██╔╝  
██████╔╝╚██████╔╝██████╔╝███████║   ██║   
╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   

🤖 AI-Powered UI Testing Agent
```

## Signal Handling

### Web Interface Shutdown
Graceful shutdown handling for web server:
- **SIGINT** (Ctrl+C) - Graceful server stop
- **SIGTERM** - Process termination handling
- Resource cleanup and connection closing

## Default Behavior

### No Arguments
When run without arguments, defaults to interactive test mode:
```javascript
if (process.argv.length <= 2) {
  program.parse(['node', 'budsy', 'test']);
}
```

## Usage Examples

### Interactive Test Creation
```bash
# Start interactive mode
budsy test

# Or explicitly
budsy

# Follow prompts to configure and run test
```

### Direct Test Execution
```bash
# Simple web test
budsy run --url "https://app.com" --instruction "Login with test credentials"

# Mobile test with expectations
budsy run --platform android --app "com.example.app" \
         --instruction "Complete onboarding flow" \
         --expected "Welcome dashboard appears"
```

### Configuration and Monitoring
```bash
# Check current configuration
budsy config

# Verify service health
budsy health

# Start web interface
budsy web --port 8080
```

## Error Exit Codes
- **0** - Success
- **1** - Error (validation failure, execution error, service unavailable)

## Related Files
- **Test Executor:** `src/core/test-executor.js` (see [Test Executor Documentation](./core/test-executor.md))
- **Web Server:** `src/web/server.js` (see [Web Server Documentation](./web/server.md))
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](./config/index.md))
- **Logger:** `src/core/logger.js` (see [Logger Documentation](./core/logger.md))
- **Package Config:** `package.json` (see [Package Documentation](../package.md))

## Features Summary
- **Interactive Setup** - Guided test configuration
- **Multi-Platform Support** - Web, Android, iOS testing
- **AI Integration** - Intelligent test execution and verification
- **Web Interface** - Real-time test monitoring
- **Health Monitoring** - Service status checking
- **Comprehensive Logging** - Detailed execution tracking
- **Flexible Configuration** - Environment-based settings