from app.services.prompt_builder import build_system_prompt


def test_prompt_includes_system_instructions():
    prompt = build_system_prompt(board_state={}, pid="", session_rounds=[])
    assert "poker math coach" in prompt.lower()
    assert "board_update" in prompt


def test_prompt_includes_board_state():
    board = {"hole_cards": ["Ah", "Kd"], "pot_size": 100}
    prompt = build_system_prompt(board_state=board, pid="", session_rounds=[])
    assert "Ah" in prompt
    assert "100" in prompt


def test_prompt_includes_pid():
    pid = "## Leaks\n1. River calling too wide"
    prompt = build_system_prompt(board_state={}, pid=pid, session_rounds=[])
    assert "River calling too wide" in prompt


def test_prompt_includes_session_rounds():
    rounds = [{"round_number": 1, "hole_cards": ["Qh", "Jd"], "result": "won"}]
    prompt = build_system_prompt(board_state={}, pid="", session_rounds=rounds)
    assert "Qh" in prompt
