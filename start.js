#!/usr/bin/env node

/**
 * F1 Race Replay - Startup Script
 * Runs cleanup (kill_all.bat) then starts the dev server
 *
 * Usage:
 *   npm start
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

const ROOT_DIR = __dirname;
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(color, label, message) {
  console.log(`${color}[${label}]${colors.reset} ${message}`);
}

async function runCleanup() {
  log(colors.cyan, 'STARTUP', 'Running port cleanup...');

  try {
    if (os.platform() === 'win32') {
      const killScript = path.join(SCRIPTS_DIR, 'kill_all.bat');
      execSync(`"${killScript}"`, {
        stdio: 'inherit',
      });
    } else {
      log(colors.cyan, 'STARTUP', 'Cleaning up ports on Unix...');
      execSync('lsof -ti :8000 | xargs kill -9 2>/dev/null; lsof -ti :5173 | xargs kill -9 2>/dev/null; lsof -ti :3000 | xargs kill -9 2>/dev/null; true', {
        stdio: 'inherit',
        shell: '/bin/bash',
      });
    }
  } catch (error) {
    log(colors.yellow, 'STARTUP', 'Cleanup completed (or not needed)');
  }
}

async function startDevServer() {
  log(colors.cyan, 'STARTUP', 'Starting dev server...');

  const devScript = path.join(SCRIPTS_DIR, 'dev.js');
  const args = process.argv.slice(2);

  const child = spawn('node', [devScript, ...args], {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });

  process.on('SIGINT', () => {
    log(colors.yellow, 'STARTUP', 'Shutting down...');
    child.kill();
    process.exit(0);
  });

  child.on('error', (error) => {
    log(colors.yellow, 'ERROR', `Failed to start dev server: ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      process.exit(code);
    }
  });
}

async function main() {
  await runCleanup();
  await startDevServer();
}

main().catch(error => {
  log(colors.yellow, 'ERROR', error.message);
  process.exit(1);
});
