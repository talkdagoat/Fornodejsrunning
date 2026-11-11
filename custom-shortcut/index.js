import { uiohook } from 'uiohook-napi';
import { exec } from 'child_process';

console.log('Shortcut trigger running... Press Ctrl+Alt+G');

uiohook.on('keydown', (e) => {
    // Check if Ctrl (ctrlKey) and Alt (altKey) are held, and 'G' is pressed (keycode 34)
    if (e.ctrlKey && e.altKey && e.keycode === 34) {
        console.log('Shortcut activated! Opening target...');
        
        // Windows command to open a URL in the default browser
        exec('start "" "https://github.com"');
    }
});

// Start listening
uiohook.start();
