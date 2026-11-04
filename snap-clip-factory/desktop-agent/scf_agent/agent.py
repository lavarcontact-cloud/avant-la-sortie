"""Boucle principale de l'agent : tourne sans le dashboard, reprend après redémarrage."""
from __future__ import annotations

import logging
import shutil
import threading
import time
from pathlib import Path

import httpx

from . import __version__, processing
from .client import AuthError, CloudClient
from .config import AgentConfig, app_dir
from .localdb import LocalQueue
from .transfer import IntegrityError, RateLimiter, download, library_path, sha256_file

log = logging.getLogger("scf_agent")


class Agent:
    def __init__(self, cfg: AgentConfig, client: CloudClient, home: Path | None = None):
        self.cfg = cfg
        self.client = client
        self.home = home or app_dir()
        self.library = Path(cfg.library_dir)
        self.queue = LocalQueue(self.home / "agent.sqlite3")
        self.stop = threading.Event()
        self.wake = threading.Event()
        self.current_task = "inactif"
        self._missing_warned: set[str] = set()

    # ------------------------------------------------------------------ état
    @property
    def paused(self) -> bool:
        return self.queue.kv_get("paused", "0") == "1"

    def _disk(self) -> tuple[int, int]:
        self.library.mkdir(parents=True, exist_ok=True)
        u = shutil.disk_usage(self.library)
        return u.free, u.total

    def heartbeat(self) -> None:
        free, total = self._disk()
        c = self.queue.counts()
        self.client.post("/v1/devices/me/heartbeat", json={"status": {
            "app_version": __version__, "disk_free_bytes": free, "disk_total_bytes": total,
            "paused": self.paused, "current_task": self.current_task,
            "queue": {"pending": c.get("pending", 0), "downloaded": c.get("downloaded", 0),
                      "processing": c.get("processing", 0), "done": c.get("done", 0), "failed": c.get("failed", 0)},
        }})

    def handle_commands(self) -> None:
        for cmd in self.client.get("/v1/devices/me/commands").json():
            log.info("commande reçue : %s", cmd["kind"])
            if cmd["kind"] == "pause":
                self.queue.kv_set("paused", "1")
            elif cmd["kind"] == "resume":
                self.queue.kv_set("paused", "0")
            elif cmd["kind"] == "sync_now":
                self.queue.kv_set("paused", "0")
                self.queue.conn.execute("UPDATE videos SET next_attempt_at=0 WHERE stage IN ('pending','downloaded')")

    # ------------------------------------------------------------- étapes
    def reconcile(self) -> None:
        """Reprend les vidéos livrées à cet ordinateur mais pas terminées : après
        un redémarrage, ou après une relance depuis le dashboard (correctif B1,
        appelé désormais à chaque cycle)."""
        for v in self.client.get("/v1/agent/assigned").json():
            row = self.queue.get(v["id"])
            if row is None or not row["local_path"] or not Path(row["local_path"]).is_file():
                if v["id"] not in self._missing_warned:
                    self._missing_warned.add(v["id"])
                    log.warning("vidéo %s livrée mais absente localement", v["id"])
                continue
            if row["stage"] in ("delivered", "processing", "failed") and self.cfg.process_after_download:
                self.queue.set_stage(v["id"], "delivered", next_attempt_at=0)

    def fetch_inbox(self) -> list[dict]:
        r = self.client.get("/v1/agent/inbox", params={"limit": 20})
        r.raise_for_status()
        items = r.json()["items"]
        for it in items:
            self.queue.upsert_pending(it["video"])
        return items

    def download_one(self, item: dict) -> None:
        v = item["video"]
        free, _ = self._disk()
        if free - (v["size_bytes"] or 0) < self.cfg.min_free_disk_bytes:
            raise OSError("espace disque insuffisant : téléchargement suspendu")
        dup = self.queue.find_local_copy(v["sha256"])
        if dup and dup["id"] != v["id"]:
            dest = Path(dup["local_path"])
        else:
            dest = library_path(self.library, v)
            if dest.exists() and sha256_file(dest) == v["sha256"]:
                pass  # déjà là (téléchargement terminé avant un crash)
            else:
                self.current_task = f"téléchargement {v['filename']}"
                download(self.client.http, self.client.url(item["download_url"]), dest, v["sha256"], v["size_bytes"],
                         RateLimiter(self.cfg.max_download_bytes_per_s), should_stop=self.stop.is_set)
        self.queue.set_stage(v["id"], "downloaded", local_path=str(dest), last_error=None)
        r = self.client.post(f"/v1/videos/{v['id']}/delivered", json={"sha256": v["sha256"]})
        r.raise_for_status()
        self.queue.set_stage(v["id"], "delivered", attempts=0, next_attempt_at=0)
        log.info("reçue et vérifiée : %s -> %s", v["filename"], dest)

    def confirm_downloaded(self) -> None:
        """Fichier présent mais accusé de livraison non envoyé (coupure réseau)."""
        for row in self.queue.due("downloaded"):
            try:
                r = self.client.post(f"/v1/videos/{row['id']}/delivered", json={"sha256": row["sha256"]})
                r.raise_for_status()
                self.queue.set_stage(row["id"], "delivered", attempts=0, next_attempt_at=0)
            except httpx.HTTPError as e:
                self.queue.fail(row["id"], str(e), stage="downloaded")

    def process_one(self, row) -> None:
        vid, path = row["id"], Path(row["local_path"])
        self.current_task = f"traitement {row['filename']}"
        self.queue.set_stage(vid, "processing")
        try:
            self.client.post(f"/v1/videos/{vid}/state", json={"state": "PROCESSING"}).raise_for_status()
            try:
                # Résultats mis en cache sur disque : une reprise ne refait pas la transcription.
                result = processing.run_pipeline(path, self.home / "work", video_id=vid, sha256=row["sha256"],
                                                 options=self.cfg.analysis_options())
            except Exception as e:  # ffmpeg absent, fichier illisible…
                self.queue.fail(vid, str(e), stage="failed")
                self.client.post(f"/v1/videos/{vid}/state", json={"state": "FAILED", "error": str(e)[:500]})
                return
            if result.get("analysis_input"):
                self.send_analysis_input(vid, result["analysis_input"])
            self.client.post(f"/v1/videos/{vid}/state",
                             json={"state": "COMPLETED", "probe": result["probe"]}).raise_for_status()
        except httpx.HTTPError as e:
            # Correctif B2 : coupure réseau pendant le traitement -> nouvel essai différé,
            # au lieu de rester bloqué à l'étape « processing ».
            n = self.queue.fail(vid, str(e), stage="delivered")
            log.warning("traitement de %s interrompu (tentative %d) : %s", row["filename"], n, e)
            return
        self.queue.set_stage(vid, "done", attempts=0, last_error=None)

    def send_analysis_input(self, vid: str, payload: dict) -> None:
        """Envoie au Cloud les SEULES données textuelles nécessaires à l'analyse
        (transcription, timecodes, signaux). Jamais la vidéo ni l'audio."""
        r = self.client.post(f"/v1/videos/{vid}/analysis-input", json=payload)
        if r.status_code == 404 and "Not Found" in r.text:
            log.warning("serveur sans module d'analyse : données conservées localement")
            return
        r.raise_for_status()

    # --------------------------------------------------------------- boucle
    def tick(self) -> None:
        self.handle_commands()
        self.reconcile()
        self.confirm_downloaded()
        if not self.paused:
            by_id = {it["video"]["id"]: it for it in self.fetch_inbox()}
            for row in self.queue.due("pending"):
                if self.stop.is_set() or self.paused:
                    break
                item = by_id.get(row["id"])
                if item is None:
                    continue  # plus dans la boîte de réception (déjà livrée par ailleurs)
                try:
                    self.download_one(item)
                except (httpx.HTTPError, IntegrityError, OSError, InterruptedError) as e:
                    n = self.queue.fail(row["id"], str(e))
                    log.warning("échec téléchargement %s (tentative %d) : %s", row["filename"], n, e)
            if self.cfg.process_after_download:
                for row in self.queue.due("delivered"):
                    if self.stop.is_set() or self.paused:
                        break
                    self.process_one(row)
        self.current_task = "en pause" if self.paused else "inactif"
        self.heartbeat()

    def run_forever(self) -> None:
        log.info("agent démarré, bibliothèque : %s", self.library)
        self.reconcile()
        backoff = self.cfg.poll_interval_s
        while not self.stop.is_set():
            try:
                self.tick()
                backoff = self.cfg.poll_interval_s
            except AuthError as e:
                log.error("%s", e)
                return
            except (httpx.HTTPError, OSError) as e:
                backoff = min(backoff * 2, 600)
                log.warning("Cloud injoignable (%s), nouvel essai dans %ss", e, backoff)
            self.wake.wait(backoff)
            self.wake.clear()
