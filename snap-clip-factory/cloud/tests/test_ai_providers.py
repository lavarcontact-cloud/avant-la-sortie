"""Adaptateurs de fournisseurs testés au niveau HTTP, sans clé réelle."""
import json

import httpx
import pytest

from app.ai.base import LLMRequest, PermanentAIError, TransientAIError
from app.ai.config import AIConfig
from app.ai.providers import AnthropicProvider, OpenAIChatProvider, ProviderUnavailable, make_provider
from phase6_helpers import FakeLLM, anthropic_reply, settings  # noqa: F401

REQ = LLMRequest(system="sys", user="texte", max_output_tokens=500)


def test_anthropic_request_and_parsing():
    fake = FakeLLM([anthropic_reply([{"a": 1}], 111, 22)])
    r = AnthropicProvider("claude-sonnet-5-5", fake.client, "sk-test").complete(REQ)
    req = fake.requests[0]
    assert req.url.path == "/v1/messages" and req.headers["x-api-key"] == "sk-test"
    assert req.headers["anthropic-version"] == "2023-06-01"
    body = json.loads(req.content)
    assert body["model"] == "claude-sonnet-5-5" and body["system"] == "sys" and body["max_tokens"] == 500
    assert body["messages"] == [{"role": "user", "content": "texte"}]
    assert (r.input_tokens, r.output_tokens) == (111, 22) and json.loads(r.text) == {"clips": [{"a": 1}]}


def test_openai_and_compatible_request_and_parsing():
    reply = (200, {"model": "m", "choices": [{"message": {"content": '{"clips": []}'}, "finish_reason": "stop"}],
                   "usage": {"prompt_tokens": 50, "completion_tokens": 5}})
    fake = FakeLLM([reply])
    r = OpenAIChatProvider("openai", "m", fake.client, "sk-o", "https://api.openai.com").complete(REQ)
    req = fake.requests[0]
    assert req.url.path == "/v1/chat/completions" and req.headers["authorization"] == "Bearer sk-o"
    body = json.loads(req.content)
    assert body["messages"][0] == {"role": "system", "content": "sys"} and body["response_format"]["type"] == "json_object"
    assert (r.input_tokens, r.output_tokens, r.text) == (50, 5, '{"clips": []}')
    # serveur local compatible (Ollama…) : pas de clé, mode JSON désactivable
    fake2 = FakeLLM([reply])
    OpenAIChatProvider("openai_compatible", "llama", fake2.client, None, "http://localhost:11434", json_mode=False).complete(REQ)
    assert "authorization" not in fake2.requests[0].headers
    assert "response_format" not in json.loads(fake2.requests[0].content)


@pytest.mark.parametrize("status,exc", [(429, TransientAIError), (529, TransientAIError), (503, TransientAIError),
                                        (401, PermanentAIError), (400, PermanentAIError), (404, PermanentAIError)])
def test_error_mapping(status, exc):
    fake = FakeLLM([(status, {"error": {"message": "x"}})])
    with pytest.raises(exc):
        AnthropicProvider("m", fake.client, "k").complete(REQ)


def test_network_errors_are_transient():
    fake = FakeLLM([httpx.ConnectTimeout("délai")])
    with pytest.raises(TransientAIError):
        OpenAIChatProvider("openai", "m", fake.client, "k", "https://x").complete(REQ)


def test_missing_keys_are_reported_not_guessed(monkeypatch):
    for k in ("SCF_ANTHROPIC_API_KEY", "SCF_OPENAI_API_KEY", "SCF_OPENAI_COMPAT_BASE_URL"):
        monkeypatch.delenv(k, raising=False)
    for prov in ("anthropic", "openai", "openai_compatible"):
        with pytest.raises(ProviderUnavailable):
            make_provider(AIConfig(provider=prov, model="m"))
    assert make_provider(AIConfig(provider="demo")).simulated is True


def test_key_from_file(monkeypatch, tmp_path):
    f = tmp_path / "key"
    f.write_text("sk-from-file\n")
    monkeypatch.delenv("SCF_ANTHROPIC_API_KEY", raising=False)
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY_FILE", str(f))
    p = make_provider(AIConfig(provider="anthropic"))
    assert p._key == "sk-from-file" and p.model == "claude-sonnet-5-5"


def test_api_never_exposes_keys(env, monkeypatch):
    monkeypatch.setenv("SCF_ANTHROPIC_API_KEY", "sk-ant-SECRET-123")
    monkeypatch.setenv("SCF_OPENAI_API_KEY", "sk-oai-SECRET-456")
    texts = [env.c.get("/v1/ai/providers", headers=env.user).text, env.c.get("/v1/ai/config", headers=env.user).text,
             env.c.put("/v1/ai/config", headers=env.user, json={"provider": "anthropic"}).text,
             env.c.get("/v1/activity", headers=env.user).text]
    assert all("SECRET" not in t for t in texts)
    prov = {p["name"]: p for p in env.c.get("/v1/ai/providers", headers=env.user).json()["providers"]}
    assert prov["anthropic"]["configured"] and prov["openai"]["configured"]
    # réservé au compte utilisateur
    assert env.c.get("/v1/ai/config", headers=env.desk).status_code == 403
    assert env.c.get("/v1/ai/config", headers=env.ios).status_code == 403


def test_config_validation(env):
    bad = [{"provider": "inconnu"}, {"level": "extrême"}, {"min_clip_s": 30, "max_clip_s": 10},
           {"language": "français"}, {"max_cost_per_video_usd": -1}]
    for b in bad:
        assert env.c.put("/v1/ai/config", headers=env.user, json=b).status_code == 422, b
