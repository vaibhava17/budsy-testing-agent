# Package Configuration

**File:** `package.json`

## Overview
Main package configuration file for the Budsy Testing Agent project. Defines project metadata, dependencies, scripts, and Node.js requirements.

## Project Details
- **Name:** budsy-testing-agent
- **Version:** 1.0.0
- **Description:** AI-powered UI testing agent using Appium with screenshot verification
- **Author:** Hortiprise Team
- **License:** MIT
- **Engine Requirements:** Node.js >= 18.0.0

## Main Entry Point
- **Main:** `src/index.js` (CLI interface)
- **Type:** ES Module (module)

## Scripts
- `start` - Run the main CLI application
- `dev` - Run CLI with nodemon for development
- `web` - Start the web interface server
- `web:dev` - Start web interface with nodemon
- `test` - Run test examples
- `setup` - Run initial project setup

## Dependencies

### Core Dependencies
- **appium** (^2.11.5) - Mobile automation framework
- **webdriverio** (^8.40.6) - WebDriver implementation
- **axios** (^1.7.7) - HTTP client for AI backend communication
- **commander** (^12.1.0) - CLI framework
- **chalk** (^5.3.0) - Terminal string styling
- **inquirer** (^10.2.2) - Interactive command line prompts
- **dotenv** (^16.4.5) - Environment variables loader

### Web Interface Dependencies
- **express** (^4.18.2) - Web server framework
- **socket.io** (^4.7.5) - Real-time communication
- **cors** (^2.8.5) - Cross-origin resource sharing
- **multer** (^1.4.5-lts.1) - File upload handling

### Utility Dependencies
- **archiver** (^6.0.1) - Archive creation
- **chokidar** (^3.5.3) - File watching
- **uuid** (^9.0.1) - UUID generation

### Development Dependencies
- **nodemon** (^3.0.1) - Development file watcher
- **@types/node** (^22.5.5) - Node.js type definitions

## Keywords
appium, testing, ai, automation, ui-testing, screenshot, visual-testing

## Related Files
- **Configuration:** `src/config/index.js` (see [Configuration Documentation](src/config/index.md))
- **Main Entry:** `src/index.js` (see [CLI Documentation](src/index.md))
- **Web Interface:** `src/web/server.js` (see [Web Server Documentation](src/web/server.md))
- **Setup Script:** `scripts/setup.js` (see [Setup Documentation](scripts/setup.md))