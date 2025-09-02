# Logger System

**File:** `src/core/logger.js`

## Overview
Centralized logging system for the Budsy testing agent. Provides structured logging with multiple output targets, colored console output, and specialized logging methods for different components.

## Import Dependencies
```javascript
import chalk from 'chalk';                      // Terminal string styling
import fs from 'fs/promises';                   // Asynchronous file operations
import path from 'path';                        // Path utilities
import config from '../config/index.js';       // Configuration management
```

**Related Documentation:**
- [Configuration](../config/index.md) - Logging configuration settings
- chalk: External library for terminal colors
- Built-in Node.js modules for file system and path operations

## Main Class

### Logger
Singleton logging class providing comprehensive logging capabilities with multiple output targets and specialized methods.

#### Constructor
- Loads logging configuration from config
- Sets up log levels and color schemes
- Ensures log directory exists
- Configures console and file output settings

#### Properties
- **logLevel** - Current logging level (`error`, `warn`, `info`, `debug`)
- **logFile** - Log file path
- **enableConsole** - Console output enabled/disabled
- **levels** - Numeric log level mapping
- **colors** - Color scheme for different log levels

## Log Levels

### Level Hierarchy
```
error: 0    (Highest priority)
warn: 1     
info: 2
debug: 3    (Lowest priority)
```

### Color Scheme
- **error** - Red
- **warn** - Yellow  
- **info** - Blue
- **debug** - Gray
- **success** - Green

## Core Logging Methods

### `error(component, message, data)`
Logs error messages with red coloring.
```javascript
logger.error('AI-CLIENT', 'Request failed', { 
  error: error.message,
  endpoint: '/api/verify'
});
```

### `warn(component, message, data)`
Logs warning messages with yellow coloring.
```javascript
logger.warn('DRIVER', 'Element not found, retrying', {
  locator: '#submit-btn',
  attempt: 2
});
```

### `info(component, message, data)`
Logs informational messages with blue coloring.
```javascript
logger.info('EXECUTOR', 'Test execution started', {
  testId: 'test_123',
  platform: 'web'
});
```

### `debug(component, message, data)`
Logs debug messages with gray coloring.
```javascript
logger.debug('DRIVER', 'Screenshot captured', {
  filename: 'step_1.png',
  size: '1280x720'
});
```

### `success(component, message, data)`
Logs success messages with green coloring and checkmark.
```javascript
logger.success('TEST', 'Test completed successfully', {
  duration: '5.2s',
  steps: 8
});
```

## Specialized Logging Methods

### Test Lifecycle Methods

#### `testStart(testName, details)`
Logs test initiation with details.
```javascript
logger.testStart('Login functionality test', {
  testId: 'test_001',
  platform: 'web',
  url: 'https://example.com'
});
```

#### `testEnd(testName, success, duration, details)`
Logs test completion with results.
```javascript
logger.testEnd('Login functionality test', true, 5200, {
  stepsExecuted: 5,
  screenshotsTaken: 8
});
```

### Step Lifecycle Methods

#### `stepStart(stepNumber, action, description)`
Logs individual test step initiation.
```javascript
logger.stepStart(1, 'click', 'Click the login button');
```

#### `stepEnd(stepNumber, success, duration, details)`
Logs step completion with timing.
```javascript
logger.stepEnd(1, true, 1200, {
  coordinates: {x: 150, y: 300},
  confidence: 0.95
});
```

### AI Integration Methods

#### `aiRequest(endpoint, requestData)`
Logs AI backend requests.
```javascript
logger.aiRequest('/api/visual-action', {
  instruction: 'Click submit button',
  hasScreenshot: true
});
```

#### `aiResponse(endpoint, success, responseData)`
Logs AI backend responses.
```javascript
logger.aiResponse('/api/visual-action', true, {
  success: true,
  confidence: 0.92,
  coordinates: {x: 200, y: 150}
});
```

### Screenshot Logging

#### `screenshot(filename, action)`
Logs screenshot operations.
```javascript
logger.screenshot('step_1_before.png', 'captured');
```

## Message Formatting

### Format Structure
```
[timestamp] [LEVEL] [COMPONENT] message | data
```

### Example Output
```
[2025-01-10T10:30:45.123Z] [INFO] [EXECUTOR] Test execution started | {"testId":"test_123","platform":"web"}
[2025-01-10T10:30:46.234Z] [SUCCESS] [DRIVER] ✓ Element found | {"locator":"#login-btn","timeout":"5000ms"}
[2025-01-10T10:30:47.345Z] [ERROR] [AI-CLIENT] Request failed | {"error":"Network timeout","endpoint":"/api/verify"}
```

## Output Targets

### Console Output
- Colored output using chalk
- Real-time display during development
- Can be disabled via configuration

### File Output  
- Structured plain text format
- Persistent logging for analysis
- Automatic log directory creation
- Asynchronous file writing

## Configuration Integration

### Environment Variables
- `LOG_LEVEL` - Controls logging verbosity
- `LOG_FILE` - Log file location
- Console output controlled by config

### Log Level Filtering
Only messages at or above the configured level are output:
```javascript
// If LOG_LEVEL=info, these are logged:
logger.error(...)  // ✓ Logged
logger.warn(...)   // ✓ Logged  
logger.info(...)   // ✓ Logged
logger.debug(...)  // ✗ Filtered out
```

## Error Handling
- Graceful file writing failures
- Directory creation with error tolerance
- Non-blocking logging operations
- Fallback to console on file errors

## Usage Examples

### Basic Logging
```javascript
import logger from './logger.js';

logger.info('COMPONENT', 'Operation started');
logger.success('COMPONENT', 'Operation completed');
logger.error('COMPONENT', 'Operation failed', { error: 'Details' });
```

### Test Logging
```javascript
logger.testStart('User registration test');
logger.stepStart(1, 'navigate', 'Go to registration page');
logger.stepEnd(1, true, 1500);
logger.testEnd('User registration test', true, 8500);
```

### AI Integration Logging
```javascript
logger.aiRequest('/api/action', { instruction: 'Click button' });
logger.aiResponse('/api/action', true, { coordinates: {x: 100, y: 200} });
```

## Related Files
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](../config/index.md))
- **AI Client:** `src/core/ai-client.js` (see [AI Client Documentation](./ai-client.md))
- **Test Executor:** `src/core/test-executor.js` (see [Test Executor Documentation](./test-executor.md))
- **Visual Test Executor:** `src/core/visual-test-executor.js` (see [Visual Test Executor Documentation](./visual-test-executor.md))
- **Appium Driver:** `src/core/appium-driver.js` (see [Appium Driver Documentation](./appium-driver.md))
- **Web Server:** `src/web/server.js` (see [Web Server Documentation](../web/server.md))

## Singleton Export
```javascript
import { logger } from './logger.js';
import logger from './logger.js';  // Both patterns supported
```

## Performance Considerations
- Asynchronous file writing to prevent blocking
- Configurable console output for production
- Log level filtering to reduce overhead
- Structured data serialization only when needed