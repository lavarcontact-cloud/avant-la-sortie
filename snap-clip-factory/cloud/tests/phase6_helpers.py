"""Outils communs aux tests de la phase 6 (aucune clé API, aucun réseau)."""
import json

import httpx
import pytest

from app.config import Settings
from conftest import sha

SEGMENTS = [
    {"start": 0.0, "end": 3.5, "text": "I never expected the studio to call me back that night.", "speaker": None, "confidence": 0.9},
    {"start": 5.0, "end": 8.03, "text": "Wait, what? You recorded the whole album in one take?", "speaker": None, "confidence": 0.85},
    {"start": 16.03, "end": 22.6, "text": "Yes. And honestly, that [mistake?] became the best part of the song, because everybody in the room started laughing.", "speaker": None, "confidence": 0.8},
]


def payload(segments=SEGMENTS, duration=22.6, status="ok", **over):
    p = {"schema": 1, "duration_s": duration, "width": 1080, "height": 1920, "rotation": 0, "has_audio": True,
         "transcript": {"status": status, "engine": "test", "language": "en", "language_probability": 0.99,
                        "note": "", "segments": segments},
         "scenes": [{"t": 3.6, "score": 17.7}, {"t": 16.0, "score": 40}],
         "silences": [{"start": 3.5, "end": 5.0}], "loudness_per_second": [-20.0] * 23,
         "summary": {"duration_s": duration, "scene_changes": 2, "silence_ratio": 0.1, "loudness_peaks_s": [17]}}
    p.update(over)
    return p


def delivered_video(env, asset="PH-1", data=b"x" * 40, duration=22.6):
    vid = env.register(asset, data, duration_s=duration)["video"]["id"]
    s = env.upload(vid, data, chunk_size=8)
    env.c.post(f"/v1/uploads/{s['upload_id']}/complete", headers=env.ios)
    r = env.c.post(f"/v1/videos/{vid}/delivered", headers=env.desk, json={"sha256": sha(data)})
    assert r.status_code == 200, r.text
    return vid


def set_config(env, **cfg):
    base = {"provider": "demo", "level": "standard"}
    r = env.c.put("/v1/ai/config", headers=env.user, json={**base, **cfg})
    assert r.status_code == 200, r.text
    return r.json()


class FakeLLM:
    """Faux serveur HTTP de fournisseur : enregistre les requêtes, renvoie des réponses écrites à l'avance."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        r = self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]
        if isinstance(r, Exception):
            raise r
        status, body = r
        return httpx.Response(status, json=body) if isinstance(body, dict) else httpx.Response(status, text=body)

    @property
    def client(self):
        return httpx.Client(transport=httpx.MockTransport(self))


def anthropic_reply(clips, input_tokens=1200, output_tokens=300):
    return (200, {"id": "msg_test", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5",
                  "content": [{"type": "text", "text": json.dumps({"clips": clips})}],
                  "stop_reason": "end_turn", "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens}})


GOOD_CLIP = {"start_s": 4.8, "end_s": 8.2, "category": "reaction", "tags": ["surprise"],
             "title": "Tout l'album en une prise ?", "explanation": "Réaction de surprise nette, compréhensible seule.",
             "score": 74, "score_justification": "Question courte, réaction claire, début et fin nets.",
             "confidence": 0.8, "quote": "You recorded the whole album in one take?",
             "scene_description": "Échange entre deux personnes."}


@pytest.fixture
def settings(tmp_path):
    return Settings(database_url=f"sqlite:///{tmp_path}/scf.db", secret_key="test-secret-key-0123456789-abcdefghijklmnop",
                    relay_dir=tmp_path / "relay", min_chunk_size=4, default_chunk_size=1024, ai_worker=False)
