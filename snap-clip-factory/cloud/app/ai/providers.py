"""Adaptateurs de fournisseurs. Appels HTTP directs (httpx), sans SDK imposé :
ajouter un fournisseur = une classe qui implémente `complete()`."""
from __future__ import annotations

import re

import httpx

from .base import LLMRequest, LLMResponse, PermanentAIError, TransientAIError
from .config import AIConfig
from .secrets import read_secret, setting

TRANSIENT_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 529}


def _raise_for(resp: httpx.Response, provider: str) -> None:
    if resp.status_code < 400:
        return
    # Le corps d'erreur ne contient pas la clé ; on le tronque malgré tout.
    detail = resp.text[:300]
    if resp.status_code in TRANSIENT_STATUS:
        raise TransientAIError(f"{provider} HTTP {resp.status_code} : {detail}")
    raise PermanentAIError(f"{provider} HTTP {resp.status_code} : {detail}")


def _post(http: httpx.Client, provider: str, url: str, **kw) -> dict:
    try:
        resp = http.post(url, **kw)
    except (httpx.TimeoutException, httpx.NetworkError) as e:
        raise TransientAIError(f"{provider} injoignable : {type(e).__name__}") from e
    _raise_for(resp, provider)
    try:
        return resp.json()
    except ValueError as e:
        raise TransientAIError(f"{provider} : réponse non JSON") from e


class AnthropicProvider:
    """API Messages d'Anthropic."""
    name = "anthropic"
    simulated = False

    def __init__(self, model: str, http: httpx.Client, api_key: str, base_url: str = "https://api.anthropic.com"):
        self.model, self.http, self._key, self.base_url = model, http, api_key, base_url.rstrip("/")

    def complete(self, req: LLMRequest) -> LLMResponse:
        data = _post(self.http, self.name, f"{self.base_url}/v1/messages",
                     headers={"x-api-key": self._key, "anthropic-version": "2023-06-01",
                              "content-type": "application/json"},
                     json={"model": self.model, "max_tokens": req.max_output_tokens, "temperature": req.temperature,
                           "system": req.system, "messages": [{"role": "user", "content": req.user}]},
                     timeout=180)
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
        usage = data.get("usage", {})
        return LLMResponse(text=text, input_tokens=int(usage.get("input_tokens", 0)),
                           output_tokens=int(usage.get("output_tokens", 0)), model=data.get("model", self.model),
                           raw_stop_reason=data.get("stop_reason"))


class OpenAIChatProvider:
    """API Chat Completions d'OpenAI, et de tout serveur compatible
    (Ollama, vLLM, LM Studio, etc.) via `base_url`."""

    simulated = False

    def __init__(self, name: str, model: str, http: httpx.Client, api_key: str | None, base_url: str,
                 json_mode: bool = True):
        self.name, self.model, self.http, self._key = name, model, http, api_key
        self.base_url, self.json_mode = base_url.rstrip("/"), json_mode

    def complete(self, req: LLMRequest) -> LLMResponse:
        body = {"model": self.model, "temperature": req.temperature, "max_tokens": req.max_output_tokens,
                "messages": [{"role": "system", "content": req.system}, {"role": "user", "content": req.user}]}
        if self.json_mode:
            body["response_format"] = {"type": "json_object"}
        headers = {"content-type": "application/json"}
        if self._key:
            headers["authorization"] = f"Bearer {self._key}"
        data = _post(self.http, self.name, f"{self.base_url}/v1/chat/completions", headers=headers, json=body,
                     timeout=180)
        choices = data.get("choices") or []
        if not choices:
            raise TransientAIError(f"{self.name} : réponse sans contenu")
        usage = data.get("usage", {})
        return LLMResponse(text=choices[0].get("message", {}).get("content") or "",
                           input_tokens=int(usage.get("prompt_tokens", 0)),
                           output_tokens=int(usage.get("completion_tokens", 0)),
                           model=data.get("model", self.model), raw_stop_reason=choices[0].get("finish_reason"))


class DemoProvider:
    """MODE DÉMO : aucune IA. Règles simples sur la transcription et le son,
    pour essayer le Studio sans clé. Chaque résultat est marqué SIMULÉ et ne
    peut jamais être validé ni publié."""

    name = "demo"
    model = "heuristique-v1"
    simulated = True

    LAUGH = re.compile(r"\b(laugh\w*|funny|haha|lol|rire|rigol\w*|drôle|mdr|ptdr)\b", re.I)
    STORY = re.compile(r"\b(because|then|so|parce que|alors|ensuite|du coup|quand)\b", re.I)

    def complete(self, req: LLMRequest) -> LLMResponse:
        import json

        ctx = req.context
        clips = []
        for seg in ctx.get("segments", []):
            text = seg["text"]
            words = len(text.split())
            if not words:
                continue
            if self.LAUGH.search(text):
                cat, score, why = "humour", 62, "mot lié au rire détecté"
            elif "?" in text or "!" in text:
                cat, score, why = "reaction", 55, "question ou exclamation"
            elif words >= 14 and self.STORY.search(text):
                cat, score, why = "anecdote", 50, "phrase longue avec connecteur de récit"
            elif words <= 12:
                cat, score, why = "punchline", 45, "phrase courte et autonome"
            else:
                continue
            clips.append({"start_s": seg["start"] - 0.3, "end_s": seg["end"] + 0.5, "category": cat,
                          "tags": ["démo"], "title": f"[DÉMO] {text[:60]}",
                          "explanation": f"[DÉMO — règle heuristique, pas une analyse IA] {why}.",
                          "score": score, "score_justification": "[DÉMO] score fixe par règle, sans valeur éditoriale",
                          "confidence": 0.2, "quote": text.strip(),
                          "scene_description": "[DÉMO] non analysée"})
        if not clips:   # pas de parole : on s'appuie sur les pics sonores
            for t in ctx.get("loudness_peaks_s", [])[:2]:
                clips.append({"start_s": t - 3, "end_s": t + 4, "category": "moment_fort", "tags": ["démo", "son"],
                              "title": f"[DÉMO] pic sonore à {t} s",
                              "explanation": "[DÉMO — règle heuristique] passage parmi les plus forts en volume.",
                              "score": 30, "score_justification": "[DÉMO] niveau sonore uniquement",
                              "confidence": 0.1, "quote": "", "scene_description": "[DÉMO] non analysée"})
        text = json.dumps({"clips": clips[: ctx.get("clips_per_window", 5)]}, ensure_ascii=False)
        return LLMResponse(text=text, input_tokens=0, output_tokens=0, model=self.model)


class ProviderUnavailable(PermanentAIError):
    pass


def make_provider(cfg: AIConfig, http: httpx.Client | None = None):
    http = http or httpx.Client()
    model = cfg.effective_model
    if cfg.provider == "demo":
        return DemoProvider()
    if not model:
        raise ProviderUnavailable(f"aucun modèle choisi pour {cfg.provider}")
    if cfg.provider == "anthropic":
        key = read_secret("ANTHROPIC_API_KEY")
        if not key:
            raise ProviderUnavailable("SCF_ANTHROPIC_API_KEY absente sur le serveur")
        return AnthropicProvider(model, http, key, setting("ANTHROPIC_BASE_URL", "https://api.anthropic.com"))
    if cfg.provider == "openai":
        key = read_secret("OPENAI_API_KEY")
        if not key:
            raise ProviderUnavailable("SCF_OPENAI_API_KEY absente sur le serveur")
        return OpenAIChatProvider("openai", model, http, key, setting("OPENAI_BASE_URL", "https://api.openai.com"))
    if cfg.provider == "openai_compatible":
        base = setting("OPENAI_COMPAT_BASE_URL")
        if not base:
            raise ProviderUnavailable("SCF_OPENAI_COMPAT_BASE_URL absente sur le serveur")
        return OpenAIChatProvider("openai_compatible", model, http, read_secret("OPENAI_COMPAT_API_KEY"), base,
                                  json_mode=setting("OPENAI_COMPAT_JSON_MODE", "1") == "1")
    raise ProviderUnavailable(f"fournisseur inconnu : {cfg.provider}")
