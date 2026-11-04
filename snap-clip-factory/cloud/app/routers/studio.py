"""Phase 6 : réception des données d'analyse (agent), Studio de validation (utilisateur).

Rien ici ne modifie la synchronisation : ces routes lisent les vidéos et
écrivent uniquement dans les tables `analysis_*`, `clips` et `ai_configs`.
"""
from __future__ import annotations

import hashlib
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..ai.config import AIConfig, provider_status
from ..ai.moments import _norm, excerpt
from ..clips import CATEGORIES, ClipState, ClipTransitionError, approve, transition
from ..deps import AppContext, Principal, ctx, get_db, log_activity, require_desktop, require_user
from ..models import AIConfigRow, AnalysisInput, AnalysisJob, Clip, Video, now
from ..worker import enqueue, load_config
from .videos import get_owned_video

router = APIRouter(prefix="/v1", tags=["studio"])
MAX_INPUT_BYTES = 2 * 1024 * 1024   # transcription + signaux d'une vidéo : texte uniquement


# --- Données d'analyse envoyées par l'agent (schéma strict : du texte et des nombres) ---
class SegmentIn(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str = Field(max_length=5000)
    speaker: str | None = Field(default=None, max_length=40)
    confidence: float | None = None


class TranscriptIn(BaseModel):
    status: Literal["ok", "no_speech", "no_audio", "unavailable", "error"]
    engine: str = Field(max_length=80)
    language: str | None = Field(default=None, max_length=16)
    language_probability: float | None = None
    note: str = Field(default="", max_length=500)
    segments: list[SegmentIn] = Field(default_factory=list, max_length=20000)


class AnalysisPayload(BaseModel):
    model_config = {"extra": "forbid"}   # aucun champ inattendu (ex. données binaires)
    schema_: int = Field(alias="schema", ge=1, le=1)
    duration_s: float = Field(ge=0)
    width: int | None = None
    height: int | None = None
    rotation: int = 0
    has_audio: bool
    transcript: TranscriptIn
    scenes: list[dict] = Field(default_factory=list, max_length=20000)
    silences: list[dict] = Field(default_factory=list, max_length=20000)
    loudness_per_second: list[float] = Field(default_factory=list, max_length=7 * 24 * 3600)
    summary: dict = Field(default_factory=dict)


@router.post("/videos/{video_id}/analysis-input", status_code=202)
async def analysis_input(video_id: str, request: Request, p: Principal = Depends(require_desktop),
                         c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    raw = await request.body()
    if len(raw) > MAX_INPUT_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "données d'analyse trop volumineuses")
    try:
        body = AnalysisPayload.model_validate_json(raw)
    except ValidationError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, e.errors(include_url=False)[:5])
    v = get_owned_video(db, p, video_id)
    if v.desktop_device_id != p.device.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "vidéo livrée à un autre ordinateur")
    payload = body.model_dump(by_alias=True)
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    inp = db.scalar(select(AnalysisInput).where(AnalysisInput.video_id == v.id))
    if inp is not None and inp.payload_sha256 == digest:
        job = db.scalar(select(AnalysisJob).where(AnalysisJob.video_id == v.id).order_by(AnalysisJob.created_at.desc()))
        return {"input_id": inp.id, "job_id": job.id if job else None, "duplicate": True}   # renvoi idempotent
    if inp is None:
        inp = AnalysisInput(user_id=v.user_id, video_id=v.id, payload=payload, payload_sha256=digest,
                            transcript_status=body.transcript.status, language=body.transcript.language)
        db.add(inp)
    else:
        inp.payload, inp.payload_sha256 = payload, digest
        inp.transcript_status, inp.language = body.transcript.status, body.transcript.language
    db.flush()
    cfg = load_config(db, v.user_id)
    job = enqueue(db, c, v, inp, cfg) if cfg.auto_analyze else None
    db.commit()
    return {"input_id": inp.id, "job_id": job.id if job else None, "duplicate": False}


# --- Studio (compte utilisateur uniquement) ---------------------------------------
def job_out(j: AnalysisJob | None) -> dict | None:
    if j is None:
        return None
    return {"id": j.id, "status": j.status, "provider": j.provider, "model": j.model, "level": j.level,
            "simulated": j.simulated, "attempts": j.attempts, "error": j.error,
            "input_tokens": j.input_tokens, "output_tokens": j.output_tokens,
            "estimated_cost_usd": j.estimated_cost_usd, "cost_usd": j.cost_usd,
            "windows": (j.progress or {}).get("windows"), "rejected": (j.progress or {}).get("rejected", []),
            "created_at": j.created_at, "finished_at": j.finished_at}


def clip_out(cl: Clip) -> dict:
    return {f: getattr(cl, f) for f in (
        "id", "video_id", "job_id", "start_s", "end_s", "proposed_start_s", "proposed_end_s", "transcript_excerpt",
        "scene_description", "category", "tags", "title", "explanation", "score", "score_justification",
        "confidence", "quote", "quote_verified", "warnings", "output_format", "estimated_duration_s", "state",
        "history", "review_note", "approved_at", "render_path", "provider", "model", "simulated", "updated_at")}


@router.get("/studio/videos")
def studio_videos(limit: int = Query(100, le=500), p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    vids = db.scalars(select(Video).where(Video.user_id == p.user_id)
                      .order_by(Video.source_created_at.desc().nulls_last(), Video.created_at.desc()).limit(limit)).all()
    ids = [v.id for v in vids]
    inputs = {i.video_id: i for i in db.scalars(select(AnalysisInput).where(AnalysisInput.video_id.in_(ids)))}
    jobs: dict[str, AnalysisJob] = {}
    for j in db.scalars(select(AnalysisJob).where(AnalysisJob.video_id.in_(ids)).order_by(AnalysisJob.created_at)):
        jobs[j.video_id] = j   # la plus récente gagne
    counts = dict(db.execute(select(Clip.video_id, func.count()).where(Clip.video_id.in_(ids))
                             .group_by(Clip.video_id)).all())
    costs = dict(db.execute(select(AnalysisJob.video_id, func.sum(AnalysisJob.cost_usd))
                            .where(AnalysisJob.video_id.in_(ids)).group_by(AnalysisJob.video_id)).all())
    return [{
        "id": v.id, "filename": v.filename, "source_created_at": v.source_created_at, "duration_s": v.duration_s,
        "state": v.state, "on_desktop": v.delivered_at is not None,
        "transcript_status": inputs[v.id].transcript_status if v.id in inputs else None,
        "language": inputs[v.id].language if v.id in inputs else None,
        "job": job_out(jobs.get(v.id)), "clips": counts.get(v.id, 0), "total_cost_usd": costs.get(v.id),
    } for v in vids]


@router.get("/studio/videos/{video_id}")
def studio_video(video_id: str, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    v = get_owned_video(db, p, video_id)
    inp = db.scalar(select(AnalysisInput).where(AnalysisInput.video_id == v.id))
    jobs = db.scalars(select(AnalysisJob).where(AnalysisJob.video_id == v.id).order_by(AnalysisJob.created_at.desc())).all()
    clips = db.scalars(select(Clip).where(Clip.video_id == v.id).order_by(Clip.start_s)).all()
    pl = inp.payload if inp else {}
    return {"video": {"id": v.id, "filename": v.filename, "duration_s": v.duration_s, "state": v.state,
                      "source_created_at": v.source_created_at, "probe": v.probe},
            "transcript": pl.get("transcript"), "summary": pl.get("summary"), "scenes": pl.get("scenes", []),
            "jobs": [job_out(j) for j in jobs], "clips": [clip_out(cl) for cl in clips]}


@router.post("/studio/videos/{video_id}/analyze", status_code=202)
def reanalyze(video_id: str, p: Principal = Depends(require_user), c: AppContext = Depends(ctx),
              db: Session = Depends(get_db)):
    v = get_owned_video(db, p, video_id)
    inp = db.scalar(select(AnalysisInput).where(AnalysisInput.video_id == v.id))
    if inp is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "pas encore de transcription reçue de l'ordinateur")
    if db.scalar(select(AnalysisJob).where(AnalysisJob.video_id == v.id, AnalysisJob.status.in_(["queued", "running"]))):
        raise HTTPException(status.HTTP_409_CONFLICT, "une analyse est déjà en cours")
    job = enqueue(db, c, v, inp, load_config(db, p.user_id))
    db.commit()
    return job_out(job)


@router.get("/clips")
def list_clips(video_id: str | None = None, category: str | None = None, min_score: int = Query(0, ge=0, le=100),
               state: str | None = None, limit: int = Query(200, le=1000),
               p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    q = select(Clip).where(Clip.user_id == p.user_id, Clip.score >= min_score)
    if video_id:
        q = q.where(Clip.video_id == video_id)
    if category:
        q = q.where(Clip.category == category)
    if state:
        q = q.where(Clip.state == state)
    return [clip_out(cl) for cl in db.scalars(q.order_by(Clip.score.desc(), Clip.start_s).limit(limit)).all()]


def _owned_clip(db: Session, p: Principal, clip_id: str) -> Clip:
    cl = db.get(Clip, clip_id)
    if cl is None or cl.user_id != p.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "clip inconnu")
    return cl


class ClipEdit(BaseModel):
    start_s: float | None = Field(default=None, ge=0)
    end_s: float | None = Field(default=None, ge=0)
    title: str | None = Field(default=None, max_length=160)


@router.patch("/clips/{clip_id}")
def edit_clip(clip_id: str, body: ClipEdit, p: Principal = Depends(require_user), c: AppContext = Depends(ctx),
              db: Session = Depends(get_db)):
    cl = _owned_clip(db, p, clip_id)
    v = db.get(Video, cl.video_id)
    start = cl.start_s if body.start_s is None else body.start_s
    end = cl.end_s if body.end_s is None else body.end_s
    limit = (v.duration_s or (v.probe or {}).get("duration_s") or 1e9)
    if end <= start or end > limit + 0.05:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"timecodes invalides (0 ≤ début < fin ≤ {limit:.2f} s)")
    if cl.state == ClipState.REJECTED:
        raise HTTPException(status.HTTP_409_CONFLICT, "remettre le clip en revue avant de le modifier")
    cl.start_s, cl.end_s = round(start, 2), round(end, 2)
    cl.estimated_duration_s = round(end - start, 2)
    # l'extrait et la vérification de citation suivent les nouveaux timecodes
    inp = db.scalar(select(AnalysisInput).where(AnalysisInput.video_id == cl.video_id))
    if inp is not None:
        segs = inp.payload.get("transcript", {}).get("segments", [])
        cl.transcript_excerpt = excerpt(segs, cl.start_s, cl.end_s)[:4000]
        cl.quote_verified = bool(cl.quote) and _norm(cl.quote) in _norm(cl.transcript_excerpt)
    if body.title is not None:
        cl.title = body.title
    if cl.state in (ClipState.APPROVED, ClipState.RENDERED):
        transition(cl, ClipState.READY_FOR_REVIEW, by=f"user:{p.user_id}", note="modifié après validation")
    else:
        cl.history = [*(cl.history or []), {"from": cl.state, "to": cl.state, "by": f"user:{p.user_id}",
                                            "at": now().isoformat(), "note": "modifié"}]
    log_activity(db, c, user_id=p.user_id, action="clip.edited", clip_id=cl.id, state=cl.state)
    db.commit()
    return clip_out(cl)


class Review(BaseModel):
    note: str = Field(default="", max_length=500)


@router.post("/clips/{clip_id}/{action}")
def review_clip(clip_id: str, action: Literal["approve", "reject", "reopen"], body: Review | None = None,
                p: Principal = Depends(require_user), c: AppContext = Depends(ctx), db: Session = Depends(get_db)):
    """Validation humaine : uniquement avec un jeton de COMPTE UTILISATEUR."""
    cl = _owned_clip(db, p, clip_id)
    note = body.note if body else ""
    try:
        if action == "approve":
            approve(cl, user_id=p.user_id, note=note)
        elif action == "reject":
            transition(cl, ClipState.REJECTED, by=f"user:{p.user_id}", note=note)
        else:
            transition(cl, ClipState.READY_FOR_REVIEW, by=f"user:{p.user_id}", note=note)
    except ClipTransitionError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    cl.review_note = note
    log_activity(db, c, user_id=p.user_id, action=f"clip.{action}", clip_id=cl.id, state=cl.state, filename=cl.title)
    db.commit()
    return clip_out(cl)


# --- Réglages IA ------------------------------------------------------------------
@router.get("/ai/providers")
def providers(p: Principal = Depends(require_user)):
    return {"providers": provider_status(), "categories": list(CATEGORIES)}


@router.get("/ai/config")
def get_config(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    cfg = load_config(db, p.user_id)
    return {**cfg.model_dump(), "effective_model": cfg.effective_model}


@router.put("/ai/config")
def put_config(body: AIConfig, p: Principal = Depends(require_user), c: AppContext = Depends(ctx),
               db: Session = Depends(get_db)):
    row = db.get(AIConfigRow, p.user_id)
    if row is None:
        db.add(AIConfigRow(user_id=p.user_id, data=body.model_dump()))
    else:
        row.data = body.model_dump()
    log_activity(db, c, user_id=p.user_id, action="ai.config", provider=body.provider, model=body.effective_model)
    db.commit()
    return {**body.model_dump(), "effective_model": body.effective_model}


@router.get("/ai/usage")
def usage(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.execute(select(AnalysisJob.status, func.count(), func.sum(AnalysisJob.input_tokens),
                             func.sum(AnalysisJob.output_tokens), func.sum(AnalysisJob.cost_usd))
                      .where(AnalysisJob.user_id == p.user_id).group_by(AnalysisJob.status)).all()
    unknown = db.scalar(select(func.count()).where(AnalysisJob.user_id == p.user_id, AnalysisJob.status == "done",
                                                   AnalysisJob.cost_usd.is_(None)))
    return {"by_status": {s: {"jobs": n, "input_tokens": i or 0, "output_tokens": o or 0, "cost_usd": cst}
                          for s, n, i, o, cst in rows},
            "jobs_with_unknown_cost": unknown}
