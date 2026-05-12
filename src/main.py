import os
import asyncio
import logging
from telegram import Bot, Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from openai import OpenAI

# Setup logging
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# API Keys and Bot Tokens
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

BOT_TOKENS = {
    "agent1": "8637645009:AAGGZySuIQixiPbQ7nzgknVVDKDGHh0vOf8",
    "agent2": "8766930130:AAHviBloNktYxuOMppg4wjedyJmAl0Eldwk",
    "agent3": "8780758697:AAHhmUbeCnDSiRad7y-Q91mVDDg0o5sK50o",
    "agent4": "8623373530:AAFUUeSanH2aboH6ZsGn5quCHIqT5kSBV9E",
    "agent5": "8731377222:AAEhUjyFx-jTIYI4tAJ3om-NseBsBgu0fGA"
}

# Mapping of which bot sends to which bot
WORKFLOW = {
    "agent1": "agent2",
    "agent2": "agent3",
    "agent3": "agent4",
    "agent4": "agent5",
    "agent5": None  # Final agent
}

AGENT_PROMPTS = {
    "agent1": "You are a Research Agent. Your task is to research the internet for gaps and problems that can be solved by an app. Identify the top 5 app ideas that solve real-world problems. Send these 5 ideas to the next agent.",
    "agent2": "You are a Validation Agent. You will receive 5 app ideas. Research which one has the best market potential and is most likely to succeed. Pick the BEST single app idea and send it to the next agent.",
    "agent3": "You are a Feature Architect. You will receive one app idea. List all the essential features required for this app to be successful and explain how the system will work. Send this to the next agent.",
    "agent4": "You are a PRD Writer. You will receive an app idea and its features. Create a comprehensive Product Requirements Document (PRD) including features, user flow, and implementation steps. Send this to the next agent.",
    "agent5": "You are a Technical Consultant. You will receive a PRD. Review the features and confirm the technical requirements. List all the materials, tools, and technologies needed to build this app. This is the final step."
}

async def get_ai_response(agent_id, user_input):
    prompt = AGENT_PROMPTS[agent_id]
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_input}
        ]
    )
    return response.choices[0].message.content

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE, agent_id: str):
    text = update.message.text
    logger.info(f"Agent {agent_id} received message: {text[:50]}...")
    
    # Process with AI
    ai_output = await get_ai_response(agent_id, text)
    await update.message.reply_text(f"--- {agent_id.upper()} PROCESSING COMPLETE ---\n\n{ai_output}")
    
    # Forward to next agent if exists
    next_agent = WORKFLOW.get(agent_id)
    if next_agent:
        next_token = BOT_TOKENS[next_agent]
        next_bot = Bot(token=next_token)
        # We need a chat ID to send to. For this workflow, we'll send it back to the same user 
        # but the user will see it coming from the next bot if they interact with it.
        # However, in a real 'agent' workflow, we might want to trigger the next bot automatically.
        # Since bots can't easily message each other directly without a shared chat, 
        # we will simulate the flow by having the current bot tell the user what to send to the next one,
        # or we can try to send it to the user's chat ID via the next bot's token.
        chat_id = update.effective_chat.id
        await next_bot.send_message(chat_id=chat_id, text=f"Message from {agent_id}:\n\n{ai_output}")
        await update.message.reply_text(f"Sent output to {next_agent}.")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("I am ready. Send me a topic or just say 'start' to begin the research workflow.")

def create_agent_app(agent_id, token):
    application = Application.builder().token(token).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, 
        lambda u, c: handle_message(u, c, agent_id)))
    return application

async def main():
    # Run all bots concurrently
    apps = [create_agent_app(aid, token) for aid, token in BOT_TOKENS.items()]
    
    # Start all applications
    tasks = [app.initialize() for app in apps]
    await asyncio.gather(*tasks)
    
    tasks = [app.start() for app in apps]
    await asyncio.gather(*tasks)
    
    tasks = [app.updater.start_polling() for app in apps]
    await asyncio.gather(*tasks)
    
    logger.info("All bots are running...")
    # Keep running until interrupted
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
