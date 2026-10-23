"""Exercise the final image offline; usage: python3 tools/container/functional-check.py IMAGE."""
from pathlib import Path
import subprocess
import sys

image = sys.argv[1] if len(sys.argv) > 1 else 'seasonalnet-discord-bot:local'
source = Path(__file__).with_name('functional.mjs').read_text()
subprocess.run([
    'docker', 'run', '--rm', '--interactive', '--network', 'none',
    '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,mode=1777', image,
    '/nodejs/bin/node', '--input-type=module', '-',
], input=source, text=True, check=True, timeout=90)
