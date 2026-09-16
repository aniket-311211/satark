PY ?= python3
VENV = .venv
BIN = $(VENV)/bin

.PHONY: install seed seed-synthetic book news api worker web test eval eval-real load up seed-docker down mcp-config

install:
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -U pip
	$(BIN)/pip install -e "backend[dev]"
	cd frontend && npm install

seed:            ## watchlists + the real customer book (committed snapshots), then screen everyone
	cd backend && ../$(BIN)/satark seed

seed-synthetic:  ## the old Faker book with planted variants
	cd backend && ../$(BIN)/satark seed --synthetic

book:            ## rebuild data/book from GLEIF and Companies House (group B needs SATARK_COMPANIES_HOUSE_KEY)
	cd backend && ../$(BIN)/satark book build

news:            ## poll the allowlisted regulator and publisher feeds into the local index
	cd backend && ../$(BIN)/satark news poll

api:
	cd backend && ../$(BIN)/satark serve --reload

worker:
	cd backend && ../$(BIN)/satark worker

web:
	cd frontend && npm run dev

test:
	cd backend && ../$(BIN)/pytest -q

eval:
	cd backend && ../$(BIN)/satark eval --gate

eval-real:
	cd backend && ../$(BIN)/satark eval --real --gate

load:
	$(BIN)/locust -f loadtest/locustfile.py --host http://127.0.0.1:8000 --headless -u 50 -r 10 -t 60s

up:
	docker compose up --build -d

seed-docker:
	docker compose exec api satark seed

down:
	docker compose down

mcp-config:
	@printf '{\n  "mcpServers": {\n    "satark": {\n      "command": "%s/$(BIN)/satark",\n      "args": ["mcp"]\n    }\n  }\n}\n' "$$(pwd)"
