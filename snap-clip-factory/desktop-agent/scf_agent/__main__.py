"""scf-agent : audit | pair | run | status | autostart"""
from __future__ import annotations

import argparse
import json
import logging
import logging.handlers
import platform
import signal
import socket
import sys
from pathlib import Path

from .agent import Agent
from .audit import audit
from .autostart import install_autostart, uninstall_autostart
from .client import CloudClient
from .config import AgentConfig, SecretStore, app_dir, platform_label


def _logging(verbose: bool) -> None:
    home = app_dir()
    home.mkdir(parents=True, exist_ok=True)
    handlers = [logging.StreamHandler(),
                logging.handlers.RotatingFileHandler(home / "agent.log", maxBytes=5_000_000, backupCount=3)]
    logging.basicConfig(level=logging.DEBUG if verbose else logging.INFO, handlers=handlers,
                        format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.DEBUG if verbose else logging.WARNING)  # URL signées hors journal


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="scf-agent", description="SNAP CLIP FACTORY — agent desktop")
    ap.add_argument("-v", "--verbose", action="store_true")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("audit", help="PHASE 1 : inventaire matériel et logiciel")
    p = sub.add_parser("pair", help="appairer cet ordinateur avec un code du dashboard")
    p.add_argument("--server", required=True, help="ex. https://scf.example.com")
    p.add_argument("--code", required=True)
    p.add_argument("--name", default=socket.gethostname())
    p.add_argument("--library", help="dossier de stockage local des vidéos")
    sub.add_parser("run", help="lancer l'agent (boucle de synchronisation)")
    sub.add_parser("status", help="état de la file locale")
    ip = sub.add_parser("import", help="importer des vidéos du PC dans le système, sans iPhone (copie, original intact)")
    ip.add_argument("paths", nargs="+", help="fichiers vidéo ou dossiers")
    ip.add_argument("--server", help="ex. http://127.0.0.1:8000 (mémorisé après la 1re fois)")
    ip.add_argument("--code", help="code d'appairage du dashboard (1re fois seulement)")
    bp = sub.add_parser("bench", help="PHASE 6.1 : banc d'essai transcription sur un dossier de vidéos")
    bp.add_argument("--videos", required=True, help="dossier de vidéos (+ <nom>.srt ou <nom>.txt de référence)")
    bp.add_argument("--out", help="dossier du rapport (défaut : <videos>/rapport)")
    bp.add_argument("--model", default=None, help="tiny | base | small | medium | large-v3")
    bp.add_argument("--language", default=None, help="auto ou code (fr, en…)")
    bp.add_argument("--device", default=None, help="auto | cpu | cuda")
    a = sub.add_parser("autostart", help="démarrage automatique à l'ouverture de session")
    a.add_argument("action", choices=["enable", "disable"])
    args = ap.parse_args(argv)
    _logging(args.verbose)

    cfg = AgentConfig.load()
    if args.cmd == "audit":
        print(json.dumps(audit(Path(cfg.library_dir)), indent=2, ensure_ascii=False))
        return 0
    if args.cmd == "pair":
        if not args.server.startswith("https://") and not args.server.startswith("http://localhost") \
                and not args.server.startswith("http://127.0.0.1"):
            print("Refus : le serveur doit être en HTTPS (sauf localhost).", file=sys.stderr)
            return 2
        cfg.server = args.server
        if args.library:
            cfg.library_dir = str(Path(args.library).expanduser().resolve())
        cfg.device_id = CloudClient(cfg.server, SecretStore()).pair(args.code, args.name, platform_label())
        cfg.save()
        print(f"Appairé (appareil {cfg.device_id}). Bibliothèque : {cfg.library_dir}")
        return 0
    if args.cmd == "import":
        from .importer import ImportError_, run as import_run

        if args.server and not (args.server.startswith("https://") or args.server.startswith("http://localhost")
                                or args.server.startswith("http://127.0.0.1")):
            print("Refus : le serveur doit être en HTTPS (sauf localhost).", file=sys.stderr)
            return 2
        try:
            import_run(args.paths, args.server, args.code)
        except ImportError_ as e:
            print(f"Erreur : {e}", file=sys.stderr)
            return 1
        return 0
    if args.cmd == "bench":
        from .bench import run as bench_run

        opts = cfg.analysis_options()
        opts.update({k: v for k, v in {"whisper_model": args.model, "language": args.language,
                                       "whisper_device": args.device}.items() if v})
        videos = Path(args.videos).expanduser()
        bench_run(videos, Path(args.out).expanduser() if args.out else videos / "rapport", opts)
        return 0
    if args.cmd == "autostart":
        (install_autostart if args.action == "enable" else uninstall_autostart)()
        return 0
    if not cfg.server:
        print("Agent non appairé : lancer `scf-agent pair --server … --code …`", file=sys.stderr)
        return 2
    agent = Agent(cfg, CloudClient(cfg.server, SecretStore()))
    if args.cmd == "status":
        print(json.dumps({"server": cfg.server, "library": cfg.library_dir, "paused": agent.paused,
                          "queue": agent.queue.counts()}, indent=2, ensure_ascii=False))
        return 0

    def _stop(*_):
        agent.stop.set()
        agent.wake.set()
    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)
    agent.run_forever()
    return 0


if __name__ == "__main__":
    sys.exit(main())
