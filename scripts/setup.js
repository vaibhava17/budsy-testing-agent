#!/usr/bin/env node

/**
 * Budsy Setup Script
 * Automated setup and verification script for Budsy testing agent
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';

const BUDSY_LOGO = `
██████╗ ██╗   ██╗██████╗ ███████╗██╗   ██╗
██╔══██╗██║   ██║██╔══██╗██╔════╝╚██╗ ██╔╝
██████╔╝██║   ██║██║  ██║███████╗ ╚████╔╝ 
██╔══██╗██║   ██║██║  ██║╚════██║  ╚██╔╝  
██████╔╝╚██████╔╝██████╔╝███████║   ██║   
╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   

🔧 Setup & Configuration
`;

class BudsySetup {
  constructor() {
    this.rootDir = process.cwd();
    this.envFile = path.join(this.rootDir, '.env');
    this.exampleEnvFile = path.join(this.rootDir, '.env.example');
  }

  async run() {
    console.log(chalk.cyan(BUDSY_LOGO));
    console.log(chalk.yellow('Welcome to Budsy setup! Let\\'s configure your testing environment.\n'));

    try {
      await this.checkPrerequisites();
      await this.setupConfiguration();
      await this.createDirectories();
      await this.verifySetup();
      
      console.log(chalk.green('\n🎉 Setup completed successfully!'));
      console.log(chalk.blue('\nNext steps:'));
      console.log(chalk.yellow('1. Start your backend service with UI verification module'));
      console.log(chalk.yellow('2. Start Appium server: npx appium server --port 4723'));
      console.log(chalk.yellow('3. Run your first test: npm start'));

    } catch (error) {
      console.error(chalk.red(`\n❌ Setup failed: ${error.message}`));
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log(chalk.blue('🔍 Checking prerequisites...\n'));

    const checks = [
      {
        name: 'Node.js',
        command: 'node --version',
        version: '18.0.0',
        required: true
      },
      {
        name: 'NPM',
        command: 'npm --version',
        required: true
      },
      {
        name: 'Appium',
        command: 'npx appium --version',
        required: true,
        installCmd: 'npm install -g appium'
      },
      {
        name: 'Chrome Browser',
        command: 'google-chrome --version',
        required: false,
        altCommand: 'chrome --version'
      }
    ];

    for (const check of checks) {
      try {
        let output;
        try {
          output = execSync(check.command, { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
          if (check.altCommand) {
            output = execSync(check.altCommand, { encoding: 'utf8', stdio: 'pipe' });
          } else {
            throw error;
          }
        }
        
        console.log(`${chalk.green('✓')} ${check.name}: ${output.trim()}`);
      } catch (error) {
        if (check.required) {
          console.log(`${chalk.red('✗')} ${check.name}: Not found`);
          if (check.installCmd) {
            console.log(`  Install with: ${chalk.yellow(check.installCmd)}`);
          }
          throw new Error(`Required dependency ${check.name} not found`);
        } else {
          console.log(`${chalk.yellow('⚠')} ${check.name}: Not found (optional)`);
        }
      }
    }

    console.log(chalk.green('\n✅ Prerequisites check completed!'));
  }

  async setupConfiguration() {
    console.log(chalk.blue('\n⚙️  Setting up configuration...\n'));

    // Check if .env already exists
    const envExists = await this.fileExists(this.envFile);
    if (envExists) {
      const { overwrite } = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: '.env file already exists. Overwrite?',
        default: false
      }]);

      if (!overwrite) {
        console.log(chalk.yellow('Skipping configuration setup.'));
        return;
      }
    }

    // Get configuration from user
    const config = await inquirer.prompt([
      {
        type: 'input',
        name: 'backendUrl',
        message: 'Backend LLM service URL:',
        default: 'http://localhost:8000'
      },
      {
        type: 'password',
        name: 'apiAuthKey',
        message: 'Backend API authentication key:',
        mask: '*'
      },
      {
        type: 'input',
        name: 'appiumUrl',
        message: 'Appium server URL:',
        default: 'http://localhost:4723'
      },
      {
        type: 'list',
        name: 'defaultBrowser',
        message: 'Default browser for web testing:',
        choices: ['chrome', 'firefox', 'safari', 'edge'],
        default: 'chrome'
      },
      {
        type: 'input',
        name: 'screenshotDir',
        message: 'Screenshot directory:',
        default: './screenshots'
      },
      {
        type: 'confirm',
        name: 'saveScreenshots',
        message: 'Save screenshots by default?',
        default: true
      },
      {
        type: 'list',
        name: 'logLevel',
        message: 'Default log level:',
        choices: ['error', 'warn', 'info', 'debug'],
        default: 'info'
      }
    ]);

    // Create .env file
    await this.createEnvFile(config);
    console.log(chalk.green('✅ Configuration file created!'));
  }

  async createDirectories() {
    console.log(chalk.blue('\n📁 Creating directories...\n'));

    const directories = [
      'screenshots',
      'logs',
      'temp'
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.rootDir, dir);
      try {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`${chalk.green('✓')} Created: ${dir}/`);
      } catch (error) {
        console.log(`${chalk.yellow('⚠')} Directory ${dir}/ already exists`);
      }
    }

    console.log(chalk.green('\n✅ Directories created!'));
  }

  async verifySetup() {
    console.log(chalk.blue('\n🔎 Verifying setup...\n'));

    // Check required files
    const requiredFiles = [
      '.env',
      'package.json',
      'src/index.js',
      'src/config/index.js'
    ];

    for (const file of requiredFiles) {
      const exists = await this.fileExists(path.join(this.rootDir, file));
      if (exists) {
        console.log(`${chalk.green('✓')} ${file}`);
      } else {
        throw new Error(`Required file not found: ${file}`);
      }
    }

    // Check directories
    const requiredDirs = ['screenshots', 'logs'];
    for (const dir of requiredDirs) {
      const exists = await this.directoryExists(path.join(this.rootDir, dir));
      if (exists) {
        console.log(`${chalk.green('✓')} ${dir}/`);
      } else {
        throw new Error(`Required directory not found: ${dir}/`);
      }
    }

    console.log(chalk.green('\n✅ Setup verification completed!'));
  }

  async createEnvFile(config) {
    const envContent = `# Budsy Testing Agent Configuration
# Generated on ${new Date().toISOString()}

# Backend LLM Service Configuration
BACKEND_URL=${config.backendUrl}
API_AUTH_KEY=${config.apiAuthKey}

# Appium Configuration
APPIUM_SERVER_URL=${config.appiumUrl}
APPIUM_LOG_LEVEL=info

# Browser Configuration (for web testing)
DEFAULT_BROWSER=${config.defaultBrowser}
BROWSER_WINDOW_WIDTH=1280
BROWSER_WINDOW_HEIGHT=720

# Screenshot Configuration
SCREENSHOT_DIR=${config.screenshotDir}
SAVE_SCREENSHOTS=${config.saveScreenshots}

# Test Configuration
DEFAULT_TIMEOUT=10000
STEP_DELAY=1000

# Logging Configuration
LOG_LEVEL=${config.logLevel}
LOG_FILE=./logs/budsy.log
`;

    await fs.writeFile(this.envFile, envContent);
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new BudsySetup();
  setup.run().catch(console.error);
}

export default BudsySetup;