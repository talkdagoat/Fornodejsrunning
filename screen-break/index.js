const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP_DATA_DIR = path.join(process.env.LOCALAPPDATA || process.env.USERPROFILE, 'SmartBreakUtility');
const AHK_SCRIPT_PATH = path.join(APP_DATA_DIR, 'SmartBreak.ahk');
const STARTUP_DIR = path.join(process.env.APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs\\Startup');

const ahkScriptContent = `#Requires AutoHotkey v2.0
#SingleInstance Force
Persistent

global EnabledStatus := 1         
global IntervalMinutes := 60      
global BreakDurationSeconds := 30 
global MyGui := ""
global BreakGui := ""

UpdateTimer()

UpdateTimer() {
    SetTimer(EnforceBreak, 0)
    if (EnabledStatus == 1) {
        IntervalMs := IntervalMinutes * 60 * 1000
        SetTimer(EnforceBreak, IntervalMs)
    }
}

EnforceBreak() {
    global BreakGui, BreakDurationSeconds
    BlockInput("On")
    
    BreakGui := Gui("-Caption +AlwaysOnTop +ToolWindow")
    BreakGui.BackColor := "000000"
    BreakGui.SetFont("s24 Bold", "Segoe UI")
    
    BreakGui.Add("Text", "cWhite w1000 Center x" (A_ScreenWidth-1000)/2 " y" (A_ScreenHeight-150)/2, "SCREEN BREAK TIME\`nTake a quick rest!")
    
    BreakGui.Show("x0 y0 w" A_ScreenWidth " h" A_ScreenHeight)
    Sleep(BreakDurationSeconds * 1000)
    
    BreakGui.Destroy()
    BlockInput("Off")
}

^!b:: {
    global MyGui, EnabledStatus, IntervalMinutes, BreakDurationSeconds
    
    if (MyGui != "") {
        MyGui.Destroy()
    }
    
    MyGui := Gui("-MinimizeBox -MaximizeBox +AlwaysOnTop", "Smart Break Configuration")
    MyGui.SetFont("s10", "Segoe UI")
    
    StatusText := (EnabledStatus == 1) ? "Status: ACTIVE (ON)" : "Status: DISABLED (OFF)"
    
    MyGui.SetFont("s11 Bold")
    StatusDisplay := MyGui.Add("Text", "w250 Center vStatusDisplay", StatusText)
    MyGui.SetFont("s10 Norm")
    
    MyGui.Add("Text", "x20 y50", "Interval (Minutes):")
    IntervalInput := MyGui.Add("Edit", "x160 y47 w60 vNewInterval Number", IntervalMinutes)
    
    MyGui.Add("Text", "x20 y85", "Break Length (Seconds):")
    DurationInput := MyGui.Add("Edit", "x160 y82 w60 vNewDuration Number", BreakDurationSeconds)
    
    ToggleBtn := MyGui.Add("Button", "x20 y125 w100", "Toggle ON/OFF")
    ToggleBtn.OnEvent("Click", (*) => ToggleStatusAction(StatusDisplay))
    
    SaveBtn := MyGui.Add("Button", "x160 y125 w100", "Save & Apply")
    SaveBtn.OnEvent("Click", (*) => SaveSettingsAction(IntervalInput, DurationInput))
    
    CloseBtn := MyGui.Add("Button", "x90 y165 w100", "Hide Menu")
    CloseBtn.OnEvent("Click", (*) => MyGui.Destroy())
    
    MyGui.Show("w290 h210")
}

ToggleStatusAction(StatusCtrl) {
    global EnabledStatus
    if (EnabledStatus == 1) {
        EnabledStatus := 0
        StatusCtrl.Text := "Status: DISABLED (OFF)"
    } else {
        EnabledStatus := 1
        StatusCtrl.Text := "Status: ACTIVE (ON)"
    }
}

SaveSettingsAction(IntervalCtrl, DurationCtrl) {
    global IntervalMinutes, BreakDurationSeconds, MyGui
    ParsedMins := Integer(IntervalCtrl.Value)
    ParsedSecs := Integer(DurationCtrl.Value)
    
    if (ParsedMins > 0 && ParsedSecs > 0) {
        IntervalMinutes := ParsedMins
        BreakDurationSeconds := ParsedSecs
        UpdateTimer()
        MsgBox("Settings saved successfully!", "Smart Break", 64)
        MyGui.Destroy()
    } else {
        MsgBox("Please enter valid positive numbers.", "Error", 48)
    }
}
`;

function setupAndInstall() {
    try {
        // Extract the bundled AutoHotkey setup installer file safely from virtual memory
        const tempAhkInstaller = path.join(process.env.TEMP || process.env.USERPROFILE, 'AutoHotkey_Setup.exe');
        const ahkBinary = fs.readFileSync(path.join(__dirname, 'AutoHotkey_2.0.18_setup.exe'));
        fs.writeFileSync(tempAhkInstaller, ahkBinary);

        console.log("Installing required AutoHotkey environment silently...");
        
        // Run the installer silently in the background
        exec(`"${tempAhkInstaller}" /Silent`, (ahkErr) => {
            if (ahkErr) {
                console.error("AutoHotkey setup step was skipped or already exists:", ahkErr.message);
            }

            // Create target utility data directory if missing
            if (!fs.existsSync(APP_DATA_DIR)) {
                fs.mkdirSync(APP_DATA_DIR, { recursive: true });
            }

            // Save the clean AHK v2 script string down to disk
            fs.writeFileSync(AHK_SCRIPT_PATH, ahkScriptContent, 'utf8');

            // Configure startup folder environment properties
            const startupShortcutPath = path.join(STARTUP_DIR, 'SmartBreak.lnk');
            const createShortcutCommand = `powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('${startupShortcutPath}'); $Shortcut.TargetPath = '${AHK_SCRIPT_PATH}'; $Shortcut.Save()"`;
            
            exec(createShortcutCommand, (err) => {
                if (err) console.error('Failed creating windows startup link:', err.message);
                
                // Fire up the script process instantly
                exec(`start "" "${AHK_SCRIPT_PATH}"`, (launchErr) => {
                    if (launchErr) console.error('Could not boot AutoHotkey engine:', launchErr.message);
                    showWelcomeDialog();
                });
            });
        });

    } catch (error) {
        console.error('Installation pipeline encountered a problem:', error.message);
    }
}

function showWelcomeDialog() {
    const psCommand = `powershell -Command "[void][System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Smart Break Utility successfully installed and active!\\n\\nPress [ Ctrl + Alt + B ] at any time to open your configuration menu.', 'Setup Complete', 0, 64)"`;
    exec(psCommand, () => {
        process.exit(0);
    });
}

setupAndInstall();
