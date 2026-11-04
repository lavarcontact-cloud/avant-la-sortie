"""Évaluation de la sélection (phase 6.1).

Toutes les mesures viennent de décisions humaines réelles enregistrées dans
`clip_feedback` et `manual_selections`. Les clips SIMULÉS (mode démo) sont
toujours comptés à part et exclus des taux, sauf demande explicite.

Le « guidage » optionnel (`use_feedback_guidance`) ne fait qu'ajouter à la
consigne un RÉSUMÉ CHIFFRÉ de tes préférences : aucun modèle n'est entraîné,
aucune transcription passée n'est renvoyée au fournisseur.
"""
from __future__ import annotations

import statistics
from collections import Counter, defaultdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .clips import ClipState
from .models import AnalysisInput, AnalysisJob, Clip, ClipFeedback, ManualSelection, Video, now

REJECT_REASONS = {
    "pas_interessant": "Pas intéressant / pas drôle",
    "hors_contexte": "Incompréhensible sans le contexte",
    "coupe_debut": "Mauvais début (trop tôt ou trop tard)",
    "coupe_fin": "Mauvaise fin (trop tôt ou trop tard)",
    "transcription_fausse": "Transcription fausse",
    "categorie_fausse": "Mauvaise catégorie",
    "trop_prive": "Trop privé ou sensible",
    "qualite_technique": "Son ou image de mauvaise qualité",
    "doublon": "Doublon d'un autre passage",
    "autre": "Autre",
}
MATCH_IOU = 0.3
SCORE_BUCKETS = [(0, 39), (40, 59), (60, 79), (80, 100)]


def iou(a0: float, a1: float, b0: float, b1: float) -> float:
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    union = max(a1, b1) - min(a0, b0)
    return inter / union if union > 0 else 0.0


def _rate(ok: int, ko: int) -> float | None:
    return round(ok / (ok + ko), 3) if ok + ko else None


def _stats(values: list[float]) -> dict:
    if not values:
        return {"n": 0}
    return {"n": len(values), "mean": round(statistics.fmean(values), 3), "median": round(statistics.median(values), 3),
            "max": round(max(values), 3)}


def report(db: Session, user_id: str, *, days: int | None = None, provider: str | None = None,
           include_simulated: bool = False) -> dict:
    q = select(Clip).where(Clip.user_id == user_id)
    if days:
        q = q.where(Clip.created_at >= now() - timedelta(days=days))
    if provider:
        q = q.where(Clip.provider == provider)
    all_clips = db.scalars(q).all()
    simulated = [c for c in all_clips if c.simulated]
    clips = all_clips if include_simulated else [c for c in all_clips if not c.simulated]

    approved_states = {ClipState.APPROVED.value, ClipState.RENDERED.value}
    approved = [c for c in clips if c.state in approved_states]
    rejected = [c for c in clips if c.state == ClipState.REJECTED.value]
    pending = [c for c in clips if c.state == ClipState.READY_FOR_REVIEW.value]

    def group(key):
        out = defaultdict(lambda: {"proposed": 0, "approved": 0, "rejected": 0})
        for c in clips:
            g = out[key(c)]
            g["proposed"] += 1
            g["approved"] += c.state in approved_states
            g["rejected"] += c.state == ClipState.REJECTED.value
        for g in out.values():
            g["acceptance_rate"] = _rate(g["approved"], g["rejected"])
        return dict(out)

    def bucket(c):
        return next(f"{a}-{b}" for a, b in SCORE_BUCKETS if a <= c.score <= b)

    # motifs : dernière décision de refus de chaque clip refusé
    ids = {c.id for c in rejected}
    last_reject: dict[str, ClipFeedback] = {}
    for fb in db.scalars(select(ClipFeedback).where(ClipFeedback.user_id == user_id, ClipFeedback.decision == "reject")
                         .order_by(ClipFeedback.id)):
        if fb.clip_id in ids:
            last_reject[fb.clip_id] = fb
    reasons = Counter(r for fb in last_reject.values() for r in (fb.reasons or []))
    no_reason = sum(1 for cid in ids if not (last_reject.get(cid) and last_reject[cid].reasons))

    # qualité des timecodes : combien l'humain a déplacé les bornes des clips acceptés
    d_start = [abs(c.start_s - c.proposed_start_s) for c in approved]
    d_end = [abs(c.end_s - c.proposed_end_s) for c in approved]
    moved = [max(a, b) for a, b in zip(d_start, d_end)]
    tc = {"approved_clips": len(approved), "start_shift_s": _stats(d_start), "end_shift_s": _stats(d_end),
          "unchanged_share": round(sum(m < 0.05 for m in moved) / len(moved), 3) if moved else None,
          "within_1s_share": round(sum(m <= 1 for m in moved) / len(moved), 3) if moved else None,
          "signed_end_shift_mean_s": round(statistics.fmean([c.end_s - c.proposed_end_s for c in approved]), 3)
          if approved else None}

    return {
        "scope": {"days": days, "provider": provider, "include_simulated": include_simulated},
        "totals": {"proposed": len(clips), "approved": len(approved), "rejected": len(rejected),
                   "pending_review": len(pending), "acceptance_rate": _rate(len(approved), len(rejected)),
                   "simulated_excluded": 0 if include_simulated else len(simulated)},
        "by_category": group(lambda c: c.category),
        "by_score_bucket": group(bucket),
        "by_model": group(lambda c: f"{c.provider}:{c.model}"),
        "rejection_reasons": {k: {"label": REJECT_REASONS.get(k, k), "count": n} for k, n in reasons.most_common()},
        "rejected_without_reason": no_reason,
        "timecodes": tc,
        "manual_comparison": manual_comparison(db, user_id, clips),
        "processing": processing_stats(db, user_id, include_simulated),
    }


def manual_comparison(db: Session, user_id: str, clips: list[Clip]) -> dict:
    """Passages que tu aurais choisis vs propositions de l'IA (recouvrement ≥ 30 %)."""
    sels = db.scalars(select(ManualSelection).where(ManualSelection.user_id == user_id)).all()
    if not sels:
        return {"videos": 0, "manual_selections": 0, "note": "aucune sélection manuelle enregistrée"}
    analyzed = {j.video_id for j in db.scalars(select(AnalysisJob).where(AnalysisJob.user_id == user_id,
                                                                         AnalysisJob.status == "done"))}
    by_video = defaultdict(list)
    for c in clips:
        by_video[c.video_id].append(c)
    found, missed, cat_agree, matched_clip_ids = 0, [], 0, set()
    considered = [s for s in sels if s.video_id in analyzed]
    for s in considered:
        best = max(by_video.get(s.video_id, []), key=lambda c: iou(s.start_s, s.end_s, c.start_s, c.end_s), default=None)
        if best is not None and iou(s.start_s, s.end_s, best.start_s, best.end_s) >= MATCH_IOU:
            found += 1
            matched_clip_ids.add(best.id)
            cat_agree += bool(s.category) and s.category == best.category
        else:
            missed.append({"video_id": s.video_id, "start_s": s.start_s, "end_s": s.end_s, "category": s.category,
                           "note": s.note})
    vids = {s.video_id for s in considered}
    ai_clips = [c for c in clips if c.video_id in vids]
    return {
        "videos": len(vids), "manual_selections": len(considered),
        "not_yet_analyzed": len(sels) - len(considered),
        "found_by_ai": found, "recall": _rate(found, len(considered) - found),
        "ai_proposals_on_these_videos": len(ai_clips),
        "ai_proposals_matching_manual": len(matched_clip_ids),
        "category_agreement": _rate(cat_agree, found - cat_agree) if found else None,
        "missed": missed[:50], "match_rule": f"recouvrement (IoU) ≥ {MATCH_IOU}",
    }


def processing_stats(db: Session, user_id: str, include_simulated: bool) -> dict:
    per_video = []
    inputs = {i.video_id: i for i in db.scalars(select(AnalysisInput).where(AnalysisInput.user_id == user_id))}
    jobs = db.scalars(select(AnalysisJob).where(AnalysisJob.user_id == user_id, AnalysisJob.status == "done")
                      .order_by(AnalysisJob.finished_at)).all()
    last = {j.video_id: j for j in jobs}
    for vid, j in last.items():
        if j.simulated and not include_simulated:
            continue
        v, inp = db.get(Video, vid), inputs.get(vid)
        summ = (inp.payload.get("summary") if inp else {}) or {}
        local = (summ.get("timings_s") or {}).get("total")
        dur = (inp.payload.get("duration_s") if inp else None) or (v.duration_s if v else None)
        per_video.append({
            "video_id": vid, "filename": v.filename if v else "?", "duration_s": dur,
            "transcript_status": inp.transcript_status if inp else None, "engine": summ.get("engine"),
            "local_processing_s": local,
            "realtime_factor": round(local / dur, 3) if local and dur else None,
            "cloud_analysis_s": round((j.finished_at - j.started_at).total_seconds(), 3) if j.started_at and j.finished_at else None,
            "cost_usd": j.cost_usd, "input_tokens": j.input_tokens, "output_tokens": j.output_tokens,
            "clips": db.query(Clip).filter(Clip.job_id == j.id).count(), "provider": j.provider, "model": j.model,
            "simulated": j.simulated,
        })
    costs = [p["cost_usd"] for p in per_video if p["cost_usd"] is not None]
    return {
        "videos": len(per_video),
        "local_processing_s": _stats([p["local_processing_s"] for p in per_video if p["local_processing_s"] is not None]),
        "realtime_factor": _stats([p["realtime_factor"] for p in per_video if p["realtime_factor"] is not None]),
        "cloud_analysis_s": _stats([p["cloud_analysis_s"] for p in per_video if p["cloud_analysis_s"] is not None]),
        "cost_per_video_usd": _stats(costs), "videos_with_unknown_cost": len(per_video) - len(costs),
        "clips_per_video": _stats([p["clips"] for p in per_video]),
        "per_video": per_video,
    }


def guidance(db: Session, user_id: str, min_reviews: int = 3) -> str:
    """Résumé chiffré de tes préférences, ajouté à la consigne SI tu l'as activé.
    Aucune transcription, aucun extrait : uniquement des taux et des motifs."""
    r = report(db, user_id)
    lines = []
    for cat, g in sorted(r["by_category"].items()):
        n = g["approved"] + g["rejected"]
        if n >= min_reviews:
            lines.append(f"- {cat} : {g['approved']}/{n} acceptés")
    reasons = list(r["rejection_reasons"].values())[:3]
    tc = r["timecodes"]
    if not lines and not reasons:
        return ""
    out = ["PRÉFÉRENCES OBSERVÉES DE L'UTILISATEUR (ses décisions passées, à prendre comme indication, pas comme règle) :"]
    out += lines
    if reasons:
        out.append("Motifs de refus les plus fréquents : " + "; ".join(f"{x['label']} ({x['count']})" for x in reasons))
    if tc.get("signed_end_shift_mean_s") and abs(tc["signed_end_shift_mean_s"]) >= 0.5:
        sens = "plus tard" if tc["signed_end_shift_mean_s"] > 0 else "plus tôt"
        out.append(f"Il termine souvent les extraits {sens} que proposé ({tc['signed_end_shift_mean_s']:+.1f} s en moyenne).")
    return "\n".join(out)


def adjusted_scores(db: Session, user_id: str, clips: list[Clip], prior: int = 5, max_shift: int = 10) -> dict[str, int]:
    """Classement ajusté par catégorie, lissé (a priori de `prior` décisions à 50 %),
    borné à ±`max_shift` points. Le score d'origine reste visible et inchangé."""
    r = report(db, user_id)["by_category"]
    out = {}
    for c in clips:
        g = r.get(c.category, {"approved": 0, "rejected": 0})
        rate = (g["approved"] + prior * 0.5) / (g["approved"] + g["rejected"] + prior)
        out[c.id] = int(max(0, min(100, round(c.score + (rate - 0.5) * 2 * max_shift))))
    return out
