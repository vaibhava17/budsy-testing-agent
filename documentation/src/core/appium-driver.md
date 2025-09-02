# Appium Driver Manager

**File:** `src/core/appium-driver.js`

## Overview
Comprehensive WebDriver management system for Budsy testing. Handles Appium WebDriver initialization, screenshot capabilities, and provides both web and mobile testing support with advanced coordinate-based actions.

## Import Dependencies
```javascript
import { remote } from 'webdriverio';           // WebDriver implementation
import fs from 'fs/promises';                   // Asynchronous file operations
import path from 'path';                        // Path utilities
import config from '../config/index.js';       // Configuration management
import logger from './logger.js';              // Logging system
```

**Related Documentation:**
- [Configuration](../config/index.md) - Driver configuration settings
- [Logger](./logger.md) - Logging system
- webdriverio: External WebDriver library

## Main Class

### AppiumDriverManager
Manages WebDriver sessions with support for web browsers and mobile platforms, providing coordinate-based automation and screenshot capabilities.

#### Constructor
- Initializes driver properties
- Sets up session tracking
- Prepares action logging storage
- Configures session context

#### Properties
- **driver** - Active WebDriver instance
- **sessionId** - Current WebDriver session ID
- **screenshotCounter** - Screenshot sequence counter
- **actionLogs** - Detailed action execution logs
- **sessionContext** - Session-wide context data

## Driver Initialization

### `initWebDriver(options)`
Initializes WebDriver for web testing with fallback strategy.

**Parameters:**
- `options` - Driver configuration:
  - `capabilities` - WebDriver capabilities
  - `wdio` - WebDriverIO options
  - `windowSize` - Browser window dimensions

**Initialization Strategy:**
1. Try direct WebDriverIO (non-Appium)
2. Fallback to Appium-based WebDriver
3. Configure window size if specified

#### Direct WebDriver Mode (`_initDirectWebDriver`)
- Direct browser connection without Appium server
- Faster initialization for web testing
- Uses browser-native capabilities

#### Appium WebDriver Mode (`_initAppiumWebDriver`)
- Routes through Appium server
- Consistent interface across platforms
- Required for mobile testing

### `initMobileDriver(platform, options)`
Initializes Appium driver for mobile testing.

**Parameters:**
- `platform` - Mobile platform (`'android'` or `'ios'`)
- `options` - Mobile-specific configuration

**Capabilities:**
- **Android** - UiAutomator2 automation
- **iOS** - XCUITest automation
- Platform-specific capability handling

## Navigation and Screenshots

### `navigateTo(url)`
Navigates to specified URL (web only).
```javascript
await driver.navigateTo('https://example.com');
```

### `takeScreenshot(filename)`
Captures screenshot with automatic saving.
```javascript
const screenshot = await driver.takeScreenshot('test_step_1.png');
```

**Features:**
- Automatic filename generation
- Base64 screenshot data
- Configurable saving to disk
- Screenshot counter management

## Element Interaction

### `findElement(locator, options)`
Finds element with wait conditions.
```javascript
const element = await driver.findElement('#submit-btn', {
  timeout: 5000
});
```

### `clickElement(locator, options)`
Clicks element using locator.
```javascript
await driver.clickElement('#login-button');
```

### `typeText(locator, text, options)`
Types text into element.
```javascript
await driver.typeText('#email-input', 'user@example.com');
```

## Coordinate-Based Actions

### `clickAtCoordinates(x, y, boundingBox)`
Performs precise coordinate clicking with validation.

**Parameters:**
- `x, y` - Click coordinates
- `boundingBox` - Optional element bounds for validation

**Features:**
- Viewport-aware coordinate validation
- Precision pointer actions with sub-pixel accuracy
- Bounding box validation and adjustment
- Enhanced error handling

### `doubleClickAtCoordinates(x, y)`
Performs double-click at coordinates.
```javascript
await driver.doubleClickAtCoordinates(200, 300);
```

### `typeEmailAtCoordinates(x, y, email, options)`
Enhanced email input with improved reliability.

**Features:**
- Advanced input element detection (5 strategies)
- Multiple focus methods for better compatibility
- Email field validation and recognition
- Character-by-character typing with verification
- Enhanced clearing methods

**Detection Strategies:**
1. **Direct Detection** - Element at point
2. **Layered Detection** - Elements at point with z-index handling
3. **Child Search** - Input elements within parent
4. **Nearby Search** - Inputs within 100 pixels
5. **Pattern Matching** - Email-specific selectors

### `typeAtCoordinates(x, y, text, options)`
Types text at specific coordinates.
```javascript
await driver.typeAtCoordinates(150, 200, 'Hello World');
```

## Viewport Management

### `getScreenSize()`
Returns current screen dimensions.
```javascript
const size = await driver.getScreenSize();
// Returns: {width: 1280, height: 720}
```

### `getViewportInfo()`
Advanced viewport information with browser chrome detection.
```javascript
const viewport = await driver.getViewportInfo();
```

**Returns:**
```javascript
{
  window: {width, height},
  viewport: {
    width, height,
    scrollX, scrollY,
    scrollWidth, scrollHeight,
    clientWidth, clientHeight
  },
  browserChrome: {width, height},
  safeZone: {minX, minY, maxX, maxY}
}
```

### Coordinate Validation

#### `_validateCoordinatesWithViewport(x, y, viewportInfo, boundingBox)`
Advanced coordinate validation with viewport awareness.

**Features:**
- Viewport-relative coordinate adjustment
- Safe zone constraint application
- Bounding box optimization
- Smart positioning based on element type
- Precision targeting with safety margins

**Adjustment Logic:**
- Screen-relative to viewport-relative conversion
- Safe zone clamping (15px margins)
- Bounding box smart positioning:
  - Input fields: 25% from left, vertical center
  - Buttons: Center positioning
  - General elements: Slight offset from center

## Scrolling Operations

### `scroll(direction, amount)`
Scrolls in specified direction.
```javascript
await driver.scroll('down', 500);  // Scroll down 500px
```

**Supported Directions:**
- `'up'` - Scroll upward
- `'down'` - Scroll downward  
- `'left'` - Scroll left
- `'right'` - Scroll right

## Iterative Testing Support

### `executeActionWithLogging(action)`
Executes actions with comprehensive logging for iterative workflows.

**Parameters:**
- `action` - AI-generated action object:
  - `action_type` - Action type ('click', 'type', 'scroll', 'wait', 'navigate')
  - `coordinates` - Target coordinates
  - `input_value` - Text for type actions
  - `confidence` - AI confidence score

**Returns:**
```javascript
{
  actionResult: {
    action_type: string,
    success: boolean,
    coordinates: object,
    execution_time: number,
    element_found: boolean,
    screenshot_after: string
  },
  appiumLog: object,
  screenshotAfter: string
}
```

### Session Management

#### `getRecentLogs(limit)` / `clearLogs()`
Manages action execution logs for iterative feedback.

#### `setSessionContext(context)` / `getSessionContext()`
Manages session-wide context data.

## Advanced Features

### Email Input Enhancements
- **Field Clearing** - Multiple clearing methods (triple-click, Ctrl+A, selection)
- **Input Validation** - Email format verification
- **Progress Verification** - Typing progress confirmation
- **Error Recovery** - Comprehensive error handling

### Precision Targeting
- **Sub-pixel Accuracy** - Enhanced pointer precision
- **Element Analysis** - Smart element type detection
- **Retry Logic** - Multiple attempt strategies
- **UI Change Detection** - Screenshot comparison for action verification

## Error Handling

### Coordinate Validation Errors
- Out-of-bounds coordinate adjustment
- Invalid bounding box handling
- Viewport overflow protection

### Action Execution Errors
- Element not found recovery
- Input field validation failures
- Network timeout handling
- Session cleanup on failures

## Configuration Integration

### Browser Capabilities
Uses `config.appium.webCapabilities` for:
- Browser selection and options
- Window size configuration
- Security and sandbox settings

### Mobile Capabilities  
Uses platform-specific capabilities:
- `config.appium.androidCapabilities`
- `config.appium.iosCapabilities`

### Screenshot Settings
Uses `config.screenshots` for:
- Save location and format
- Quality settings
- Automatic saving preferences

## Usage Examples

### Basic Web Testing
```javascript
const driver = new AppiumDriverManager();
await driver.initWebDriver();
await driver.navigateTo('https://example.com');
const screenshot = await driver.takeScreenshot();
await driver.clickElement('#submit-btn');
```

### Coordinate-Based Actions
```javascript
// Precise clicking
await driver.clickAtCoordinates(200, 300);

// Email input
await driver.typeEmailAtCoordinates(150, 200, 'user@domain.com');

// General text input
await driver.typeAtCoordinates(100, 400, 'Search query');
```

### Mobile Testing
```javascript
await driver.initMobileDriver('android', {
  capabilities: {
    'appium:app': '/path/to/app.apk'
  }
});
```

## Related Files
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](../config/index.md))
- **Logger:** `src/core/logger.js` (see [Logger Documentation](./logger.md))
- **Test Executor:** `src/core/test-executor.js` (see [Test Executor Documentation](./test-executor.md))
- **Visual Test Executor:** `src/core/visual-test-executor.js` (see [Visual Test Executor Documentation](./visual-test-executor.md))

## Performance Optimizations
- Coordinate precision with integer rounding
- Efficient screenshot handling
- Optimized element detection strategies
- Minimal wait times between actions
- Smart retry logic to reduce test flakiness