"""Interface commune à tous les fournisseurs de modèles de langage."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class LLMRequest:
    system: str
    user: str
    max_output_tokens: int
    temperature: float = 0.2
    # Données structurées de la fenêtre analysée. Ignorées par les vrais
    # fournisseurs (qui lisent `user`), utilisées par le mode démo.
    context: dict = field(default_factory=dict)


@dataclass
class LLMResponse:
    text: str
    input_tokens: int
    output_tokens: int
    model: str
    raw_stop_reason: str | None = None


class AIError(RuntimeError):
    pass


class TransientAIError(AIError):
    """Erreur passagère (limite de débit, surcharge, réseau) : la tâche sera retentée."""


class PermanentAIError(AIError):
    """Erreur définitive (clé invalide, requête refusée, modèle inconnu) : pas de nouvel essai."""


class LLMProvider(Protocol):
    name: str
    model: str
    simulated: bool

    def complete(self, request: LLMRequest) -> LLMResponse: ...
