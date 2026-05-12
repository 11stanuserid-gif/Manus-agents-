# 5-Agent Telegram Bot Workflow

This project implements a sequential workflow using 5 different Telegram bots acting as agents.

## Workflow
1. **Agent 1 (Research)**: Researches internet gaps and suggests top 5 app ideas.
2. **Agent 2 (Validation)**: Validates the ideas and picks the best one.
3. **Agent 3 (Feature Architect)**: Defines features and system architecture.
4. **Agent 4 (PRD Writer)**: Creates a full Product Requirements Document (PRD).
5. **Agent 5 (Technical Consultant)**: Confirms technical requirements and materials.

## Setup
1. Clone the repo.
2. Install dependencies: `pip install -r requirements.txt`.
3. Set `OPENROUTER_API_KEY` in your environment variables. This project uses OpenRouter's free models (e.g., Gemini 2.0 Flash Exp Free).
4. Run `python src/main.py`.

## Deployment
Deployed on Render as a background worker.
