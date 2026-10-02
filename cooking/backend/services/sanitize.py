"""Sanitizers for text that crosses a trust boundary (user -> LLM, MCP -> UI/DB).

MCP product text is never sent back into an LLM prompt or used as a tool
argument in the agent flow (only ids are), but it is displayed and stored, so
it is stripped of control characters and length-capped.
"""

import re

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f​-‏‪-‮⁦-⁩]")
_SPACES = re.compile(r"\s+")


def sanitize_text(value, max_len: int = 200) -> str:
    if value is None:
        return ""
    text = _CONTROL.sub("", str(value))
    text = _SPACES.sub(" ", text).strip()
    return text[:max_len]
