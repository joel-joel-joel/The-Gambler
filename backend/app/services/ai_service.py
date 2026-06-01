import json
import re

from google import genai

from app.config import settings


def create_gemini_client() -> genai.Client | None:
    if not settings.gemini_api_key:
        return None
    return genai.Client(api_key=settings.gemini_api_key)


_client: genai.Client | None = None


def get_client() -> genai.Client | None:
    global _client
    if _client is None:
        _client = create_gemini_client()
    return _client


async def chat_with_ai(system_prompt: str, user_message: str) -> str:
    client = get_client()
    if client is None:
        return (
            "AI is not configured. Set GEMINI_API_KEY in your .env file. "
            "For now, I'll do my best as a placeholder coach: "
            "always check your pot odds against your equity!"
        )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=user_message,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
            max_output_tokens=500,
        ),
    )
    return response.text


def _find_board_update_json(text: str) -> re.Match | None:
    """Find a JSON object containing a 'board_update' key using brace matching.

    Simple regex with [^}]+ fails on nested structures like arrays or
    nested objects. Instead, we locate the candidate start position with
    a lightweight regex, then walk the string counting braces to find
    the matching closing brace.
    """
    start_pattern = re.compile(r'\{\s*"board_update"\s*:', re.DOTALL)
    for m in start_pattern.finditer(text):
        start = m.start()
        depth = 0
        i = start
        while i < len(text):
            ch = text[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        json.loads(candidate)
                        # Return a pseudo-match with start/end info
                        return type('Match', (), {
                            'start': lambda self, s=start: s,
                            'end': lambda self, e=i + 1: e,
                            'group': lambda self, _=0, c=candidate: c,
                        })()
                    except json.JSONDecodeError:
                        break
            # Skip over string literals to avoid counting braces inside them
            elif ch == '"':
                i += 1
                while i < len(text) and text[i] != '"':
                    if text[i] == '\\':
                        i += 1  # skip escaped character
                    i += 1
            i += 1
    return None


def parse_ai_response(raw_text: str) -> dict:
    match = _find_board_update_json(raw_text)
    board_update = None
    message = raw_text

    if match:
        try:
            parsed = json.loads(match.group(0))
            board_update = parsed.get("board_update")
            message = raw_text[: match.start()].strip()
            trailing = raw_text[match.end() :].strip()
            if trailing:
                message = message + "\n" + trailing if message else trailing
        except (json.JSONDecodeError, KeyError):
            pass

    if not message:
        message = raw_text

    return {"message": message, "board_update": board_update}
