.PHONY: start stop restart test logs

PORT_BACK=8002
PORT_FRONT=5173

stop:
	@echo "Stopping backend and frontend..."
	@-lsof -ti :$(PORT_BACK) | xargs kill -9 2>/dev/null; true
	@-lsof -ti :$(PORT_FRONT) | xargs kill -9 2>/dev/null; true
	@echo "Done."

start: stop
	@echo "Starting backend on :$(PORT_BACK)..."
	@cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port $(PORT_BACK) --host 127.0.0.1 > /tmp/gambler-backend.log 2>&1 & echo "  PID: $$!"
	@sleep 1
	@echo "Starting frontend on :$(PORT_FRONT)..."
	@cd frontend && npm run dev > /tmp/gambler-frontend.log 2>&1 & echo "  PID: $$!"
	@sleep 2
	@echo ""
	@echo "Open http://localhost:$(PORT_FRONT)"
	@echo "Logs: make logs"

restart: start

test:
	@cd backend && venv/bin/python -m pytest tests/ -v --tb=short
	@cd frontend && npx tsc --noEmit

logs:
	@echo "=== Backend ===" && tail -20 /tmp/gambler-backend.log 2>/dev/null || echo "(no log)"
	@echo ""
	@echo "=== Frontend ===" && tail -20 /tmp/gambler-frontend.log 2>/dev/null || echo "(no log)"
