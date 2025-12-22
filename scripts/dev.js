#!/usr/bin/env node

/**
 * F1 Race Replay - Development Server Launcher
 * One-command startup for both backend (FastAPI) and frontend (React)
 *
 * Usage:
 *   npm run dev           - Start dev servers (clears cache and ports)
 *   npm start             - Alias for npm run dev
 *   node scripts/dev.js   - Same as npm run dev
 *   npm run dev -- --no-open - Start without opening browser
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT_DIR = path.dirname(__dirname);
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');
const COMPUTED_DATA_DIR = path.join(ROOT_DIR, 'computed_data');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CACHE_DIR = path.join(ROOT_DIR, '.fastf1-cache');
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

function clearCache() {
  log(colors.cyan, 'CACHE', 'Clearing caches...');

  const dirsToClean = [
    { path: COMPUTED_DATA_DIR, name: 'computed telemetry' },
    { path: DATA_DIR, name: 'legacy data' },
    { path: CACHE_DIR, name: 'FastF1 API' },
  ];

  let clearedCount = 0;
  let failedCount = 0;

  dirsToClean.forEach(({ path: dirPath, name }) => {
    if (fs.existsSync(dirPath)) {
      try {
        fs.rmSync(dirPath, { recursive: true });
        log(colors.green, 'CACHE', `✓ Cleared ${name} cache (${dirPath})`);
        clearedCount++;
      } catch (error) {
        log(colors.yellow, 'CACHE', `✗ Could not clear ${name} cache: ${error.message}`);
        failedCount++;
      }
    } else {
      log(colors.cyan, 'CACHE', `- ${name} cache not found (${dirPath})`);
    }
  });

  log(colors.green, 'CACHE', `Cache cleanup summary: ${clearedCount} cleared, ${failedCount} failed`);
}

function clearPorts() {
  log(colors.cyan, 'PORTS', 'Clearing ports...');

  const ports = [8000, 5173, 3000];

  try {
    if (os.platform() === 'win32') {
      ports.forEach(port => {
        try {
          execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' });
          execSync(`for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /PID %a /F`, {
            stdio: 'ignore',
            shell: true,
          });
          log(colors.green, 'PORTS', `Cleared port ${port}`);
        } catch (error) {
          // Port not in use, ignore
        }
      });
    } else {
      const cmd = ports.map(port => `lsof -ti :${port} | xargs kill -9 2>/dev/null`).join('; ');
      execSync(`${cmd}; true`, {
        stdio: 'ignore',
        shell: '/bin/bash',
      });
      log(colors.green, 'PORTS', `Cleared ports: ${ports.join(', ')}`);
    }
  } catch (error) {
    log(colors.yellow, 'PORTS', 'Port cleanup encountered an issue (likely ports already free)');
  }
}

async function checkDependencies() {
  log(colors.cyan, 'SETUP', 'Checking dependencies...');

  try {
    execSync('python3 --version', { stdio: 'pipe' });
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

  const requirementsPath = path.join(BACKEND_DIR, 'requirements.txt');

  if (!fs.existsSync(requirementsPath)) {
    log(colors.yellow, 'BACKEND', 'requirements.txt not found');
    return;
  }

  try {
    execSync(`python3 -m pip install -r "${requirementsPath}" -q`, {
      cwd: BACKEND_DIR,
      stdio: 'pipe',
    });
    log(colors.green, 'BACKEND', '✓ Dependencies installed (all requirements satisfied)');
  } catch (error) {
    log(colors.yellow, 'BACKEND', '✗ Failed to install dependencies');
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

  const backend = spawn('python3', ['main.py'], {
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

  clearCache();
  clearPorts();
  console.log('');

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
