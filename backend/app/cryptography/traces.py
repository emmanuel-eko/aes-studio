"""Pedagogical trace collector.

Every real cryptographic operation can append a structured step. The frontend
replays this list; stepping backward never recomputes AES.
"""

from __future__ import annotations

from typing import Any


class TraceCollector:
    """Append-only journal of cryptographic operations."""

    def __init__(self) -> None:
        self.steps: list[dict[str, Any]] = []

    def add(
        self,
        *,
        operation: str,
        title: str,
        explanation: str,
        code_ref: str,
        phase: str,
        round_number: int | None = None,
        block_index: int | None = None,
        state_before: list[list[str]] | None = None,
        state_after: list[list[str]] | None = None,
        intermediates: dict[str, Any] | None = None,
        glossary: list[str] | None = None,
    ) -> None:
        self.steps.append(
            {
                "index": len(self.steps),
                "operation": operation,
                "title": title,
                "explanation": explanation,
                "code_ref": code_ref,
                "phase": phase,
                "round_number": round_number,
                "block_index": block_index,
                "state_before": state_before,
                "state_after": state_after,
                "intermediates": intermediates or {},
                "glossary": glossary or [],
            }
        )

    def as_list(self) -> list[dict[str, Any]]:
        return list(self.steps)
