"""Install and launch a simulator app; compile success is not launch verification."""
import json
import os
import plistlib
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time


def run(*args, check=True):
    result = subprocess.run(args, text=True, capture_output=True)
    if check and result.returncode:
        raise RuntimeError(f'{args[0:3]} failed: {result.stdout}\n{result.stderr}')
    return result.stdout.strip()


def main():
    app = Path(sys.argv[1]).resolve()
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    configuration = info.get('UIApplicationSceneManifest', {}).get('UISceneConfigurations', {}).get('UIWindowSceneSessionRoleApplication', [])
    if not configuration or not configuration[0].get('UISceneDelegateClassName', '').endswith('.SceneDelegate'):
        raise RuntimeError('Built app has no scene delegate configuration and cannot launch with the iOS 27 SDK.')
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    devices = json.loads(run('xcrun', 'simctl', 'list', 'devices', 'available', '-j'))['devices']
    phone = next((device for runtime in sorted(devices, reverse=True) if '.iOS-' in runtime
                  for device in devices[runtime] if 'iPhone' in device['name'] and device['isAvailable']), None)
    if not phone:
        raise RuntimeError('No available iPhone simulator runtime; launch was not verified.')
    udid = phone['udid']
    started = time.time()
    print(f"Checking launch on {phone['name']}", flush=True)
    if phone['state'] != 'Booted':
        run('xcrun', 'simctl', 'boot', udid)
    run('xcrun', 'simctl', 'bootstatus', udid, '-b')
    run('xcrun', 'simctl', 'install', udid, str(app))
    result = run('xcrun', 'simctl', 'launch', '--terminate-running-process',
                 f'--stdout={output / "stdout.log"}', f'--stderr={output / "stderr.log"}', udid, 'com.twilight.garden')
    print(result, flush=True)
    match = re.search(r':\s*(\d+)\s*$', result)
    if not match:
        raise RuntimeError('Simulator did not report an app process ID.')
    pid = match.group(1)
    try:
        for _ in range(20):
            time.sleep(1)
            command = run('ps', '-p', pid, '-o', 'comm=', check=False)
            if '/App.app/App' not in command:
                raise RuntimeError('App exited during the startup observation window.')
        run('xcrun', 'simctl', 'io', udid, 'screenshot', str(output / 'launch.png'))
        print('PASS: app stayed alive for 20 seconds after launch.', flush=True)
    finally:
        reports = Path.home() / 'Library/Logs/DiagnosticReports'
        if reports.exists():
            for report in reports.glob('App*'):
                if report.is_file() and report.stat().st_mtime >= started:
                    shutil.copy2(report, output / report.name)
        run('xcrun', 'simctl', 'spawn', udid, 'log', 'show', '--last', '2m', '--style', 'compact',
            '--predicate', 'process == "App"', check=False)


if __name__ == '__main__':
    main()
