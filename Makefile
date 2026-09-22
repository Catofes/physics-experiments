.PHONY: dev

PORT ?= 5173

dev:
	npm run dev -- --port $(PORT) --strictPort
