from app.services.ai_service import parse_ai_response


def test_parse_response_message_only():
    raw = "With 9 outs you have about 36% equity on the flop."
    result = parse_ai_response(raw)
    assert result["message"] == raw
    assert result["board_update"] is None


def test_parse_response_with_board_update():
    raw = (
        'Updated pot to $135. You need to call $60.\n'
        '{"board_update": {"pot_size": 135, "bet_to_call": 60}}'
    )
    result = parse_ai_response(raw)
    assert "Updated pot" in result["message"]
    assert result["board_update"]["pot_size"] == 135
    assert result["board_update"]["bet_to_call"] == 60


def test_parse_response_with_community_cards():
    raw = (
        'Flop is set.\n'
        '{"board_update": {"community_cards": ["Ah", "7d", "2c"]}}'
    )
    result = parse_ai_response(raw)
    assert result["board_update"]["community_cards"] == ["Ah", "7d", "2c"]


def test_parse_response_malformed_json_ignored():
    raw = "Some response {not valid json"
    result = parse_ai_response(raw)
    assert result["message"] == raw
    assert result["board_update"] is None


def test_parse_response_strips_json_from_message():
    raw = (
        'The pot is now $200.\n'
        '{"board_update": {"pot_size": 200}}'
    )
    result = parse_ai_response(raw)
    assert '{"board_update"' not in result["message"]
    assert "The pot is now $200." in result["message"]
