import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.models.database import SessionLocal
from app.services.ai_service import chat_with_ai, parse_ai_response
from app.services.pid_service import get_pid
from app.services.prompt_builder import build_system_prompt

router = APIRouter()


@router.websocket("/ws/chat")
async def chat_websocket(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            board_state = data.get("board_state", {})
            session_rounds = data.get("session_rounds", [])

            db = SessionLocal()
            try:
                pid = get_pid(db, "default")
            finally:
                db.close()

            system_prompt = build_system_prompt(
                board_state=board_state,
                pid=pid,
                session_rounds=session_rounds,
            )

            raw_response = await chat_with_ai(system_prompt, user_message)
            parsed = parse_ai_response(raw_response)

            await websocket.send_json(parsed)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json(
                {"message": f"Error: {str(e)}", "board_update": None}
            )
        except Exception:
            pass
