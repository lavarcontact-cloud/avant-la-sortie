"""Worker d'analyse IA : file persistante en base (`analysis_jobs`).

- reprise : chaque fenêtre analysée est enregistrée dans `progress` ; une
  tâche interrompue (redémarrage, erreur passagère) repart de la fenêtre suivante ;
- limites vérifiées AVANT tout appel payant (taille, coût par vidéo, budget du jour) ;
- erreurs passagères : nouvel essai différé (4 au plus) ; erreurs définitives : échec immédiat.
"""
from __future__ import annotations

import logging
import threading
from dataclasses import asdict
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .ai.base import PermanentAIError, TransientAIError
from .ai.config import AIConfig, estimate_cost, estimate_tokens
from .ai.moments import ValidatedClip, build_request, build_windows, dedupe, parse_response, validate
from .ai.providers import make_provider
from .clips import ClipState, transition
from .deps import AppContext, log_activity
from .models import AIConfigRow, AnalysisInput, AnalysisJob, Clip, Video, now

log = logging.getLogger("scf.worker")
MAX_ATTEMPTS = 4


def load_config(db: Session, user_id: str) -> AIConfig:
    row = db.get(AIConfigRow, user_id)
    return AIConfig(**(row.data if row else {}))


def enqueue(db: Session, c: AppContext, video: Video, inp: AnalysisInput, cfg: AIConfig) -> AnalysisJob:
    job = AnalysisJob(user_id=video.user_id, video_id=video.id, input_sha256=inp.payload_sha256,
                      provider=cfg.provider, model=cfg.effective_model, level=cfg.level,
                      simulated=cfg.provider == "demo", config_snapshot=cfg.model_dump())
    db.add(job)
    db.flush()
    log_activity(db, c, user_id=video.user_id, action="analysis.queued", video_id=video.id,
                 filename=video.filename, provider=cfg.provider)
    return job


def requeue_interrupted(c: AppContext) -> int:
    """Au démarrage : une tâche restée « running » a été interrompue."""
    with c.db.SessionLocal() as db:
        n = db.execute(update(AnalysisJob).where(AnalysisJob.status == "running")
                       .values(status="queued")).rowcount
        db.commit()
        return n


def _spent_today(db: Session, user_id: str) -> float:
    midnight = datetime.combine(now().date(), time.min, tzinfo=timezone.utc)
    return float(db.scalar(select(func.coalesce(func.sum(AnalysisJob.cost_usd), 0.0)).where(
        AnalysisJob.user_id == user_id, AnalysisJob.finished_at >= midnight)) or 0.0)


def run_once(c: AppContext, http=None) -> int:
    """Traite au plus une tâche prête. Renvoie 1 si une tâche a été prise."""
    with c.db.SessionLocal() as db:
        job = db.scalar(select(AnalysisJob).where(AnalysisJob.status == "queued",
                                                  AnalysisJob.next_attempt_at <= now())
                        .order_by(AnalysisJob.created_at).limit(1))
        if job is None:
            return 0
        claimed = db.execute(update(AnalysisJob).where(AnalysisJob.id == job.id, AnalysisJob.status == "queued")
                             .values(status="running", started_at=now())).rowcount
        db.commit()
        if not claimed:
            return 0   # prise par un autre worker
        db.refresh(job)
        try:
            _process(db, c, job, http)
        except TransientAIError as e:
            job.attempts += 1
            job.error = str(e)[:1000]
            if job.attempts >= MAX_ATTEMPTS:
                job.status, job.finished_at = "failed", now()
            else:
                job.status = "queued"
                job.next_attempt_at = now() + timedelta(seconds=30 * 2 ** (job.attempts - 1))
            log_activity(db, c, user_id=job.user_id, action="analysis.retry" if job.status == "queued"
                         else "analysis.failed", video_id=job.video_id, error=job.error, attempts=job.attempts)
        except PermanentAIError as e:
            job.status, job.error, job.finished_at = "failed", str(e)[:1000], now()
            log_activity(db, c, user_id=job.user_id, action="analysis.failed", video_id=job.video_id, error=job.error)
        except Exception as e:  # bug inattendu : on n'insiste pas en boucle
            log.exception("analyse %s", job.id)
            job.status, job.error, job.finished_at = "failed", f"erreur interne : {e}"[:1000], now()
        db.commit()
        return 1


def _block(db, c, job: AnalysisJob, reason: str) -> None:
    job.status, job.error, job.finished_at = "blocked", reason, now()
    log_activity(db, c, user_id=job.user_id, action="analysis.blocked", video_id=job.video_id, error=reason)


def _process(db: Session, c: AppContext, job: AnalysisJob, http) -> None:
    cfg = AIConfig(**job.config_snapshot)
    video = db.get(Video, job.video_id)
    inp = db.scalar(select(AnalysisInput).where(AnalysisInput.video_id == job.video_id))
    if video is None or inp is None:
        raise PermanentAIError("vidéo ou données d'analyse introuvables")
    payload = inp.payload
    segments = payload.get("transcript", {}).get("segments", [])
    params = cfg.level_params

    total_chars = sum(len(s["text"]) for s in segments)
    if total_chars > cfg.max_input_chars:
        return _block(db, c, job, f"transcription de {total_chars} caractères > limite {cfg.max_input_chars}")

    windows = build_windows(segments, float(payload.get("duration_s") or 0), params["window_chars"])
    requests = [build_request(w, payload, cfg, len(windows)) for w in windows]
    est_in = sum(estimate_tokens(r.system + r.user) for r in requests)
    est_out = sum(r.max_output_tokens for r in requests)
    job.estimated_cost_usd = estimate_cost(cfg, est_in, est_out)
    if job.estimated_cost_usd is not None and not job.progress.get("done"):
        if cfg.max_cost_per_video_usd is not None and job.estimated_cost_usd > cfg.max_cost_per_video_usd:
            return _block(db, c, job, f"coût estimé {job.estimated_cost_usd:.4f} $ > limite par vidéo "
                                      f"{cfg.max_cost_per_video_usd} $")
        if cfg.daily_budget_usd is not None and _spent_today(db, job.user_id) + job.estimated_cost_usd > cfg.daily_budget_usd:
            return _block(db, c, job, f"budget du jour ({cfg.daily_budget_usd} $) atteint")

    provider = make_provider(cfg, http)
    progress = dict(job.progress or {})
    done: list[int] = progress.get("done", [])
    raw: list[dict] = progress.get("raw", [])
    for req, win in zip(requests, windows):
        if win.index in done:
            continue   # reprise : fenêtre déjà analysée
        resp = provider.complete(req)
        clips = parse_response(resp.text)
        job.input_tokens += resp.input_tokens
        job.output_tokens += resp.output_tokens
        # on ne garde que les propositions qui tombent dans la fenêtre interrogée
        raw.extend(cl for cl in clips if _in_window(cl, win.start, win.end))
        done.append(win.index)
        job.progress = {"done": list(done), "raw": list(raw), "windows": len(windows)}
        job.cost_usd = estimate_cost(cfg, job.input_tokens, job.output_tokens)
        db.commit()   # point de reprise

    kept, rejected = validate(raw, payload, cfg)
    _store_clips(db, job, video, kept, payload, provider.simulated)
    job.status, job.finished_at, job.error = "done", now(), None
    job.progress = {**job.progress, "rejected": rejected[:50], "kept": len(kept)}
    job.cost_usd = estimate_cost(cfg, job.input_tokens, job.output_tokens)
    log_activity(db, c, user_id=job.user_id, action="analysis.done", video_id=video.id, filename=video.filename,
                 clips=len(kept), simulated=provider.simulated, cost_usd=job.cost_usd)


def _in_window(clip: dict, start: float, end: float) -> bool:
    try:
        s, e = float(clip.get("start_s")), float(clip.get("end_s"))
    except (TypeError, ValueError):
        return True   # rejet motivé plus tard par validate()
    return e > start - 1 and s < end + 1


def _store_clips(db: Session, job: AnalysisJob, video: Video, kept: list[ValidatedClip], payload: dict,
                 simulated: bool) -> None:
    # Les propositions d'une analyse précédente jamais examinées sont remplacées ;
    # celles déjà validées, refusées ou rendues sont conservées.
    for old in db.scalars(select(Clip).where(Clip.video_id == video.id,
                                             Clip.state == ClipState.READY_FOR_REVIEW.value,
                                             Clip.job_id != job.id)).all():
        if len(old.history or []) <= 3:
            db.delete(old)
    vertical = (payload.get("height") or 0) >= (payload.get("width") or 0)
    if abs(int(payload.get("rotation") or 0)) % 180 == 90:
        vertical = not vertical
    by = f"ai:{job.provider}"
    for k in kept:
        clip = Clip(user_id=job.user_id, video_id=video.id, job_id=job.id, provider=job.provider, model=job.model,
                    simulated=simulated, state=ClipState.DETECTED.value, estimated_duration_s=round(k.end_s - k.start_s, 2),
                    output_format="9:16" if vertical else "9:16 (recadrage d'une source horizontale)",
                    history=[{"from": None, "to": "DETECTED", "by": by, "at": now().isoformat(), "note": ""}],
                    **{f: v for f, v in asdict(k).items()})
        transition(clip, ClipState.ANALYZED, by="server:validation")
        transition(clip, ClipState.READY_FOR_REVIEW, by="server")
        db.add(clip)


def start_background(c: AppContext, stop: threading.Event, interval_s: float = 2.0) -> threading.Thread:
    def loop():
        requeue_interrupted(c)
        while not stop.is_set():
            try:
                if not run_once(c):
                    stop.wait(interval_s)
            except Exception:  # pragma: no cover - ne jamais tuer le worker
                log.exception("worker")
                stop.wait(interval_s)

    t = threading.Thread(target=loop, name="scf-ai-worker", daemon=True)
    t.start()
    return t


if __name__ == "__main__":   # worker séparé : `python -m app.worker` (avec SCF_AI_WORKER=0 côté API)
    import signal

    from .config import Settings
    from .db import Database
    from .events import EventBus
    from .storage import LocalRelayStorage

    logging.basicConfig(level=logging.INFO)
    st = Settings.from_env()
    db_ = Database(st.database_url)
    db_.create_all()
    ctx_ = AppContext(settings=st, db=db_, storage=LocalRelayStorage(st.relay_dir), bus=EventBus())
    ev = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: ev.set())
    signal.signal(signal.SIGINT, lambda *_: ev.set())
    start_background(ctx_, ev).join()
