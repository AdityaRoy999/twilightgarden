"""Install and launch a simulator app; compile success is not launch verification."""
import json
import plistlib
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time


def run(*args, check=True, timeout=120):
    print('Running: ' + ' '.join(args), flush=True)
    # CoreSimulator launches child services. A captured pipe can stay open after
    # simctl exits; regular files avoid waiting for inherited pipe handles.
    with tempfile.TemporaryFile(mode='w+t') as log:
        result = subprocess.run(args, text=True, stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
        log.seek(0)
        output = log.read()
    if check and result.returncode:
        raise RuntimeError(f'{args[0:3]} failed: {output}')
    return output.strip()


def main():
    app = Path(sys.argv[1]).resolve()
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    configuration = info.get('UIApplicationSceneManifest', {}).get('UISceneConfigurations', {}).get('UIWindowSceneSessionRoleApplication', [])
    if not configuration or not configuration[0].get('UISceneDelegateClassName', '').endswith('.SceneDelegate'):
        raise RuntimeError('Built app has no scene delegate configuration and cannot launch with the iOS 27 SDK.')
    output = Path(sys.argv[2]).resolve()
    output.mkdir(parents=True, exist_ok=True)
    devices = json.loads(run('xcrun', 'simctl', 'list', 'devices', 'available', '-j'))['devices']
    phones = [device for runtime in sorted(devices, reverse=True) if '.iOS-' in runtime
              for device in devices[runtime] if 'iPhone' in device['name'] and device['isAvailable']]
    phone = next((device for device in phones if device['name'] == 'iPhone 17 Pro'), phones[0] if phones else None)
    if not phone:
        raise RuntimeError('No available iPhone simulator runtime; launch was not verified.')
    udid = phone['udid']
    started = time.time()
    print(f"Checking launch on {phone['name']}", flush=True)
    if phone['state'] != 'Booted':
        run('xcrun', 'simctl', 'boot', udid)
    run('xcrun', 'simctl', 'bootstatus', udid, '-b', timeout=180)
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
            for report in reports.glob('App-*.ips'):
                if report.is_file() and report.stat().st_mtime >= started:
                    shutil.copy2(report, output / report.name)


if __name__ == '__main__':
    main()
