"""Configuration IA centralisée, par compte, modifiable depuis le Studio."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .secrets import read_secret, setting

Provider = Literal["demo", "anthropic", "openai", "openai_compatible"]
Level = Literal["rapide", "standard", "approfondi"]

# Paramètres par niveau d'analyse : taille d'une fenêtre de transcription,
# réponse maximale et nombre de propositions par fenêtre.
LEVELS: dict[str, dict] = {
    "rapide": {"window_chars": 12_000, "max_output_tokens": 1_500, "clips_per_window": 3},
    "standard": {"window_chars": 24_000, "max_output_tokens": 3_000, "clips_per_window": 5},
    "approfondi": {"window_chars": 40_000, "max_output_tokens": 6_000, "clips_per_window": 8},
}

# Modèles proposés dans l'interface (champ libre : tout nom de modèle est accepté).
SUGGESTED_MODELS: dict[str, list[str]] = {
    "demo": ["heuristique-v1"],
    "anthropic": ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5-5"],
    "openai": [],              # à renseigner selon ton compte
    "openai_compatible": [],   # ex. le nom du modèle servi par Ollama / vLLM / LM Studio
}
DEFAULT_MODEL = {"demo": "heuristique-v1", "anthropic": "claude-sonnet-5-5"}


class AIConfig(BaseModel):
    provider: Provider = "demo"
    model: str = Field(default="", max_length=120)
    language: str = Field(default="auto", pattern=r"^(auto|[a-z]{2}(-[A-Z]{2})?)$")
    level: Level = "standard"
    auto_analyze: bool = True
    # Limites
    max_cost_per_video_usd: float | None = Field(default=0.50, ge=0)
    daily_budget_usd: float | None = Field(default=5.0, ge=0)
    max_input_chars: int = Field(default=200_000, ge=1_000, le=2_000_000)
    max_clips_per_video: int = Field(default=8, ge=1, le=50)
    min_clip_s: float = Field(default=5, ge=1, le=60)
    max_clip_s: float = Field(default=60, ge=5, le=180)
    # Tarifs (USD par million de jetons). Non pré-remplis : à recopier depuis la
    # grille tarifaire du fournisseur. Sans tarif, le coût est affiché « inconnu ».
    price_input_per_mtok: float | None = Field(default=None, ge=0)
    price_output_per_mtok: float | None = Field(default=None, ge=0)

    @field_validator("max_clip_s")
    @classmethod
    def _order(cls, v, info):
        if "min_clip_s" in info.data and v < info.data["min_clip_s"]:
            raise ValueError("max_clip_s doit être ≥ min_clip_s")
        return v

    @property
    def effective_model(self) -> str:
        return self.model or DEFAULT_MODEL.get(self.provider, "")

    @property
    def level_params(self) -> dict:
        return LEVELS[self.level]


def provider_status() -> list[dict]:
    """Disponibilité de chaque fournisseur, SANS jamais exposer de clé."""
    return [
        {"name": "demo", "label": "Démo (résultats simulés, sans IA)", "configured": True,
         "models": SUGGESTED_MODELS["demo"], "simulated": True},
        {"name": "anthropic", "label": "Anthropic", "configured": bool(read_secret("ANTHROPIC_API_KEY")),
         "models": SUGGESTED_MODELS["anthropic"], "simulated": False},
        {"name": "openai", "label": "OpenAI", "configured": bool(read_secret("OPENAI_API_KEY")),
         "models": SUGGESTED_MODELS["openai"], "simulated": False},
        {"name": "openai_compatible", "label": "API compatible OpenAI (Ollama, vLLM, LM Studio…)",
         "configured": bool(setting("OPENAI_COMPAT_BASE_URL")), "models": SUGGESTED_MODELS["openai_compatible"],
         "simulated": False},
    ]


def estimate_cost(cfg: AIConfig, input_tokens: int, output_tokens: int) -> float | None:
    if cfg.provider == "demo":
        return 0.0
    if cfg.price_input_per_mtok is None or cfg.price_output_per_mtok is None:
        return None
    return round(input_tokens / 1e6 * cfg.price_input_per_mtok + output_tokens / 1e6 * cfg.price_output_per_mtok, 6)


def estimate_tokens(text: str) -> int:
    """Estimation prudente (surestime légèrement) : ~3 caractères par jeton."""
    return len(text) // 3 + 1
