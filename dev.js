#!/usr/bin/env node

/**
 * F1 Race Replay - Development Server Launcher
 * One-command startup for both backend (FastAPI) and frontend (React)
 *
 * Usage:
 *   node dev.js           - Install dependencies and start both servers
 *   node dev.js --no-open - Start servers without opening browser
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT_DIR = __dirname;
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const NO_OPEN = process.argv.includes('--no-open');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(color, label, message) {
  console.log(`${color}[${label}]${colors.reset} ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkPortInUse(port) {
  try {
    if (os.platform() === 'win32') {
      const output = execSync(`netstat -ano | find ":${port}"`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return output.includes(':' + port);
    } else {
      execSync(`lsof -i :${port}`, { stdio: 'pipe' });
      return true;
    }
  } catch {
    return false;
  }
}

async function cleanupProcesses() {
  const portsToCheck = [8000, 5173, 3000];
  const usedPorts = [];

  for (const port of portsToCheck) {
    if (await checkPortInUse(port)) {
      usedPorts.push(port);
    }
  }

  if (usedPorts.length === 0) {
    log(colors.green, 'CLEANUP', 'All ports are free - skipping cleanup');
    return;
  }

  log(colors.yellow, 'CLEANUP', `Ports in use: ${usedPorts.join(', ')}`);
  log(colors.cyan, 'CLEANUP', 'Cleaning up processes on those ports...');

  try {
    if (os.platform() === 'win32') {
      const killScript = path.join(SCRIPTS_DIR, 'kill_all.bat');
      if (fs.existsSync(killScript)) {
        execSync(`"${killScript}"`, {
          stdio: 'pipe',
          timeout: 20000,
        });
      }
    } else {
      execSync('lsof -ti :8000 | xargs kill -9 2>/dev/null; lsof -ti :5173 | xargs kill -9 2>/dev/null; lsof -ti :3000 | xargs kill -9 2>/dev/null; true', {
        stdio: 'pipe',
        shell: '/bin/bash',
      });
    }
    log(colors.green, 'CLEANUP', 'Process cleanup complete');
  } catch (error) {
    log(colors.yellow, 'CLEANUP', 'Cleanup script failed - continuing startup');
  }

  await sleep(1000);
}

async function checkDependencies() {
  log(colors.cyan, 'SETUP', 'Checking dependencies...');

  try {
    execSync('python --version', { stdio: 'pipe' });
  } catch {
    log(colors.yellow, 'SETUP', 'Python not found. Please install Python 3.8+');
    process.exit(1);
  }

  try {
    execSync('node --version', { stdio: 'pipe' });
  } catch {
    log(colors.yellow, 'SETUP', 'Node.js not found. Please install Node.js');
    process.exit(1);
  }

  try {
    execSync('npm --version', { stdio: 'pipe' });
  } catch {
    log(colors.yellow, 'SETUP', 'npm not found. Please install Node.js');
    process.exit(1);
  }
}

async function installBackendDependencies() {
  log(colors.cyan, 'BACKEND', 'Installing Python dependencies...');

  const venvPath = path.join(BACKEND_DIR, 'venv');
  const requirementsPath = path.join(BACKEND_DIR, 'requirements.txt');

  if (!fs.existsSync(requirementsPath)) {
    log(colors.yellow, 'BACKEND', 'requirements.txt not found');
    return;
  }

  try {
    execSync(`pip install -r "${requirementsPath}"`, {
      cwd: BACKEND_DIR,
      stdio: 'inherit',
    });
    log(colors.green, 'BACKEND', 'Dependencies installed');
  } catch (error) {
    log(colors.yellow, 'BACKEND', 'Failed to install dependencies');
  }
}

async function installFrontendDependencies() {
  log(colors.cyan, 'FRONTEND', 'Installing Node.js dependencies...');

  try {
    execSync('npm install', {
      cwd: FRONTEND_DIR,
      stdio: 'inherit',
    });
    log(colors.green, 'FRONTEND', 'Dependencies installed');
  } catch (error) {
    log(colors.yellow, 'FRONTEND', 'Failed to install dependencies');
  }
}

function startBackend() {
  log(colors.blue, 'BACKEND', 'Starting FastAPI server...');

  const backend = spawn('python', ['main.py'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    shell: true,
  });

  backend.on('error', (error) => {
    log(colors.yellow, 'BACKEND', `Error: ${error.message}`);
  });

  return backend;
}

function startFrontend() {
  log(colors.blue, 'FRONTEND', 'Starting Vite dev server...');

  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    shell: true,
  });

  frontend.on('error', (error) => {
    log(colors.yellow, 'FRONTEND', `Error: ${error.message}`);
  });

  return frontend;
}

async function openBrowser() {
  await sleep(3000);

  const url = 'http://localhost:5173';
  log(colors.cyan, 'BROWSER', `Opening ${url}...`);

  try {
    if (os.platform() === 'win32') {
      execSync(`start ${url}`, { stdio: 'ignore' });
    } else if (os.platform() === 'darwin') {
      execSync(`open ${url}`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open ${url}`, { stdio: 'ignore' });
    }
  } catch (error) {
    log(colors.yellow, 'BROWSER', 'Could not open browser automatically');
    log(colors.cyan, 'BROWSER', `Visit ${url} in your browser`);
  }
}

async function main() {
  console.log(`
${colors.green}╔═══════════════════════════════════════════════════════════╗${colors.reset}
${colors.green}║           F1 Race Replay - Development Server              ║${colors.reset}
${colors.green}╚═══════════════════════════════════════════════════════════╝${colors.reset}
  `);

  await cleanupProcesses();
  await checkDependencies();
  await installBackendDependencies();
  await installFrontendDependencies();

  log(colors.green, 'SETUP', 'Setup complete!');
  console.log(`
${colors.cyan}Starting servers...${colors.reset}
  Backend:  http://localhost:8000
  Frontend: http://localhost:5173
  `);

  const backend = startBackend();
  const frontend = startFrontend();

  if (!NO_OPEN) {
    openBrowser();
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log(colors.yellow, 'SHUTDOWN', 'Shutting down servers...');
    backend.kill();
    frontend.kill();
    process.exit(0);
  });
}

main().catch(error => {
  log(colors.yellow, 'ERROR', error.message);
  process.exit(1);
});
