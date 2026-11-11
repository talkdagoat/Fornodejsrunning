import { uiohook } from 'uiohook-napi';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Config path setup inside the user's local app data directory
const APP_DATA_DIR = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, 'SmartBreakUtility');
const CONFIG_PATH = path.join(APP_DATA_DIR, 'config.json');
const STARTUP_DIR = path.join(process.env.APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs\\Startup');

// Default Application State Configuration
let config = {
    enabled: true,
    intervalMinutes: 60
};

let breakTimer = null;

// --- Helper Functions ---

function ensureDirectoryExists() {
    if (!fs.existsSync(APP_DATA_DIR)) {
        fs.mkdirSync(APP_DATA_DIR, { recursive: true });
    }
}

function loadConfig() {
    ensureDirectoryExists();
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        } catch (e) {
            saveConfig();
        }
    } else {
        saveConfig();
    }
}

function saveConfig() {
    ensureDirectoryExists();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Automatically copy the running executable into the Windows Startup directory
function installToStartup() {
    try {
        const currentExePath = process.execPath;
        // Only run copy sequence if the file is actually running as a packaged binary EXE
        if (path.extname(currentExePath).toLowerCase() === '.exe') {
            const targetStartupPath = path.join(STARTUP_DIR, path.basename(currentExePath));
            if (!fs.existsSync(targetStartupPath)) {
                fs.copyFileSync(currentExePath, targetStartupPath);
                console.log('Installed successfully to Windows Startup.');
            }
        }
    } catch (error) {
        console.error('Failed to configure startup profile:', error.message);
    }
}

// Core operational mechanism controlling screen locks
function startBreakTimer() {
    if (breakTimer) clearInterval(breakTimer);
    
    if (!config.enabled) {
        console.log('Utility is currently disabled. Timer paused.');
        return;
    }

    const intervalMs = config.intervalMinutes * 60 * 1000;
    console.log(`Timer updated. System will enforce a break every ${config.intervalMinutes} minutes.`);
    
    breakTimer = setInterval(() => {
        console.log('Enforcing break condition...');
        exec('rundll32.exe user32.dll,LockWorkStation');
    }, intervalMs);
}

// --- Menu UI Management ---

function openConfigurationMenu() {
    // Bring focus to the console window using powershell command structures
    exec('powershell -Command "(New-Object -ComObject WScript.Shell).AppActivate(' + process.pid + ')"');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.clear();
    console.log('====================================');
    console.log('       SMART BREAK UTILITY          ');
    console.log('====================================');
    console.log(` Status:    ${config.enabled ? 'ON' : 'OFF'}`);
    console.log(` Interval:  ${config.intervalMinutes} Minutes`);
    console.log('------------------------------------');
    console.log(' 1. Toggle ON / OFF');
    console.log(' 2. Change Interval Timer');
    console.log(' 3. Exit Menu');
    console.log('====================================');

    rl.question('Select an option (1-3): ', (answer) => {
        if (answer.trim() === '1') {
            config.enabled = !config.enabled;
            saveConfig();
            startBreakTimer();
            rl.close();
            openConfigurationMenu();
        } else if (answer.trim() === '2') {
            rl.question('\nEnter new interval structure in minutes: ', (mins) => {
                const parsedMins = parseInt(mins, 10);
                if (!isNaN(parsedMins) && parsedMins > 0) {
                    config.intervalMinutes = parsedMins;
                    saveConfig();
                    startBreakTimer();
                } else {
                    console.log('Invalid timing entry sequence detected.');
                }
                rl.close();
                openConfigurationMenu();
            });
        } else {
            console.log('\nReturning app to background monitor context...');
            rl.close();
        }
    });
}

// --- Lifecycle Initialization ---

loadConfig();
installToStartup();
startBreakTimer();

console.log('Smart Break Service Active in Background.');
console.log('Press Ctrl + Alt + B inside your terminal workspace to open the setup screen dashboard.');

// Global Hotkey Listening Sequence
uiohook.on('keydown', (event) => {
    // Trigger configuration dashboard shortcut via Ctrl + Alt + B (B keycode is 48)
    if (event.ctrlKey && event.altKey && event.keycode === 48) {
        openConfigurationMenu();
    }
});

uiohook.start();
