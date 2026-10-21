import {execFileSync} from 'node:child_process';

// Arguments go to osascript as argv, never into AppleScript source or a shell.
export const macOfficeScript = String.raw`
on pairJSON(v)
  return "[" & (item 1 of v) & "," & (item 2 of v) & "]"
end pairJSON
on run argv
  set targetURL to item 1 of argv
  set callerName to item 2 of argv
  tell application "Finder" to set desktopBounds to bounds of window of desktop
  set x to item 1 of desktopBounds
  set y to (item 2 of desktopBounds) + 26
  set w to (item 3 of desktopBounds) - x
  set h to (item 4 of desktopBounds) - y - 50
  set halfWidth to (w - 4) div 2
  set leftPosition to {x, y}
  set paneSize to {halfWidth, h}
  set rightPosition to {x + halfWidth + 4, y}
  tell application "System Events"
    if not (exists process callerName) then error "The caller app must already be open."
    tell process callerName
      if (count of windows) is 0 then error "The caller app needs an open window."
      set frontmost to true
      set size of window 1 to paneSize
      set position of window 1 to leftPosition
    end tell
  end tell
  tell application "Google Chrome"
    activate
    set officeWindow to missing value
    repeat with candidate in windows
      try
        if URL of active tab of candidate is targetURL then
          set officeWindow to contents of candidate
          exit repeat
        end if
      end try
    end repeat
    if officeWindow is missing value then
      set officeWindow to make new window
      set URL of active tab of officeWindow to targetURL
    end if
    set bounds of officeWindow to {item 1 of rightPosition, y, (item 1 of rightPosition) + halfWidth, y + h}
  end tell
  delay 0.5
  tell application "System Events" to tell process callerName
    set actualPosition to position of window 1
    set actualSize to size of window 1
  end tell
  tell application "Google Chrome" to set actualBounds to bounds of officeWindow
  return "{\"left\":{\"position\":" & my pairJSON(actualPosition) & ",\"size\":" & my pairJSON(actualSize) & "},\"right\":{\"position\":" & my pairJSON({item 1 of actualBounds, item 2 of actualBounds}) & ",\"size\":" & my pairJSON({(item 3 of actualBounds) - (item 1 of actualBounds), (item 4 of actualBounds) - (item 2 of actualBounds)}) & "},\"target\":{\"leftPosition\":" & my pairJSON(leftPosition) & ",\"rightPosition\":" & my pairJSON(rightPosition) & ",\"size\":" & my pairJSON(paneSize) & "}}"
end run
`;

export function verifyMacLayout(layout, tolerance=12) {
  return ['left','right'].every(side=>['position','size'].every(field=>{
    const wanted=field==='size'?layout.target.size:layout.target[side+'Position'];
    const actual=layout[side]?.[field];
    return Array.isArray(actual)&&actual.length===2&&actual.every((n,i)=>Number.isFinite(n)&&Math.abs(n-wanted[i])<=tolerance);
  }));
}

export function openMacOffice(url, {callerName=process.env.BOT_CROSSING_CALLER_APP||'Codex'}={}) {
  const parsed=new URL(url);
  if(parsed.protocol!=='http:'||parsed.hostname!=='127.0.0.1')throw Error('Office must use a loopback HTTP URL.');
  if(!callerName||callerName.length>100||/[\r\n\0]/.test(callerName))throw Error('Invalid caller app name.');
  // Open the office even when macOS has not granted window-positioning permission.
  execFileSync('/usr/bin/open',['-a','Google Chrome',parsed.href],{timeout:10000});
  try {
    const layout=JSON.parse(execFileSync('/usr/bin/osascript',['-e',macOfficeScript,parsed.href,callerName],{encoding:'utf8',timeout:30000}));
    return {...layout,platform:'darwin',browser:'Google Chrome',verified:verifyMacLayout(layout),
      note:'Primary-display equal panes; readback may differ if an app enforces minimum window dimensions.'};
  } catch(error) {
    throw Error('Mac layout failed. Allow the invoking app under macOS Privacy & Security > Automation and Accessibility, then rerun. The local viewer remains available. '+(error.stderr?.toString().trim()||error.message));
  }
}
