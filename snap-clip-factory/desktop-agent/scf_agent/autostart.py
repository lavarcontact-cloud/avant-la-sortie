"""Démarrage automatique configurable : LaunchAgent (macOS), tâche planifiée
à l'ouverture de session (Windows), service utilisateur systemd (Linux)."""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from .config import app_dir

LABEL = "com.snapclipfactory.agent"


def _cmd() -> list[str]:
    return [sys.executable, "-m", "scf_agent", "run"]


def install_autostart() -> None:
    if sys.platform == "darwin":
        plist = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
        plist.parent.mkdir(parents=True, exist_ok=True)
        args = "".join(f"<string>{a}</string>" for a in _cmd())
        log = app_dir() / "launchd.log"
        plist.write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>{LABEL}</string>
  <key>ProgramArguments</key><array>{args}</array>
  <key>WorkingDirectory</key><string>{Path(__file__).resolve().parent.parent}</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>{log}</string>
  <key>StandardErrorPath</key><string>{log}</string>
</dict></plist>
""")
        subprocess.run(["launchctl", "unload", str(plist)], capture_output=True)
        subprocess.run(["launchctl", "load", "-w", str(plist)], check=True)
        print(f"LaunchAgent installé : {plist}")
    elif os.name == "nt":
        exe = sys.executable.replace("python.exe", "pythonw.exe")  # pas de fenêtre console
        tr = f'"{exe}" -m scf_agent run'
        subprocess.run(["schtasks", "/Create", "/F", "/SC", "ONLOGON", "/RL", "LIMITED", "/TN", "SnapClipFactoryAgent",
                        "/TR", tr], check=True)
        print("Tâche planifiée « SnapClipFactoryAgent » créée (à l'ouverture de session).")
    else:
        unit = Path.home() / ".config" / "systemd" / "user" / "snapclipfactory-agent.service"
        unit.parent.mkdir(parents=True, exist_ok=True)
        unit.write_text(f"""[Unit]
Description=SNAP CLIP FACTORY agent
After=network-online.target

[Service]
ExecStart={' '.join(_cmd())}
WorkingDirectory={Path(__file__).resolve().parent.parent}
Restart=on-failure
RestartSec=30

[Install]
WantedBy=default.target
""")
        subprocess.run(["systemctl", "--user", "daemon-reload"], check=False)
        subprocess.run(["systemctl", "--user", "enable", "--now", unit.name], check=False)
        print(f"Service systemd utilisateur installé : {unit}")


def uninstall_autostart() -> None:
    if sys.platform == "darwin":
        plist = Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"
        subprocess.run(["launchctl", "unload", "-w", str(plist)], capture_output=True)
        plist.unlink(missing_ok=True)
    elif os.name == "nt":
        subprocess.run(["schtasks", "/Delete", "/F", "/TN", "SnapClipFactoryAgent"], check=False)
    else:
        subprocess.run(["systemctl", "--user", "disable", "--now", "snapclipfactory-agent.service"], check=False)
        (Path.home() / ".config" / "systemd" / "user" / "snapclipfactory-agent.service").unlink(missing_ok=True)
    print("Démarrage automatique désactivé.")
