const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.get('/', (req, res) => res.send('Bots are running!'));
app.listen(port, () => console.log(`Health check server listening on port ${port}`));

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Switching to a more stable free model
const FREE_MODEL = "deepseek/deepseek-chat:free";

const BOT_TOKENS = {
    agent1: "8637645009:AAGGZySuIQixiPbQ7nzgknVVDKDGHh0vOf8",
    agent2: "8766930130:AAHviBloNktYxuOMppg4wjedyJmAl0Eldwk",
    agent3: "8780758697:AAHhmUbeCnDSiRad7y-Q91mVDDg0o5sK50o",
    agent4: "8623373530:AAFUUeSanH2aboH6ZsGn5quCHIqT5kSBV9E",
    agent5: "8731377222:AAEhUjyFx-jTIYI4tAJ3om-NseBsBgu0fGA"
};

const WORKFLOW = {
    agent1: "agent2",
    agent2: "agent3",
    agent3: "agent4",
    agent4: "agent5",
    agent5: null
};

const AGENT_PROMPTS = {
    agent1: "You are a Research Agent. Your task is to research the internet for gaps and problems that can be solved by an app. Identify the top 5 app ideas that solve real-world problems. Send these 5 ideas to the next agent.",
    agent2: "You are a Validation Agent. You will receive 5 app ideas. Research which one has the best market potential and is most likely to succeed. Pick the BEST single app idea and send it to the next agent.",
    agent3: "You are a Feature Architect. You will receive one app idea. List all the essential features required for this app to be successful and explain how the system will work. Send this to the next agent.",
    agent4: "You are a PRD Writer. You will receive an app idea and its features. Create a comprehensive Product Requirements Document (PRD) including features, user flow, and implementation steps. Send this to the next agent.",
    agent5: "You are a Technical Consultant. You will receive a PRD. Review the features and confirm the technical requirements. List all the materials, tools, and technologies needed to build this app. This is the final step."
};

async function getAIResponse(agentId, userInput) {
    const prompt = AGENT_PROMPTS[agentId];
    try {
        console.log(`Calling OpenRouter for ${agentId} with model ${FREE_MODEL}...`);
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: FREE_MODEL,
            messages: [
                { role: "system", content: prompt },
                { role: "user", content: userInput }
            ]
        }, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://render.com", // Required by some OpenRouter models
                "X-Title": "Telegram Agent Workflow"
            },
            timeout: 90000 // 90 seconds timeout
        });

        if (response.data && response.data.choices && response.data.choices[0]) {
            return response.data.choices[0].message.content;
        } else {
            console.error("Unexpected OpenRouter response format:", JSON.stringify(response.data));
            return "Error: AI returned an empty or invalid response.";
        }
    } catch (error) {
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error(`AI Error for ${agentId}:`, errorMsg);
        return `AI Service Error: ${errorMsg.substring(0, 100)}... Check Render logs for details.`;
    }
}

const bots = {};

Object.entries(BOT_TOKENS).forEach(([agentId, token]) => {
    const bot = new Telegraf(token);
    bots[agentId] = bot;

    bot.start((ctx) => ctx.reply(`Agent ${agentId} is ready. Send a topic to begin.`));

    bot.on('text', async (ctx) => {
        const text = ctx.message.text;
        console.log(`${agentId} received message: ${text.substring(0, 20)}...`);
        await ctx.reply(`Processing with ${agentId.toUpperCase()}... Please wait.`);

        const aiOutput = await getAIResponse(agentId, text);
        await ctx.reply(`--- ${agentId.toUpperCase()} COMPLETE ---\n\n${aiOutput}`);

        const nextAgentId = WORKFLOW[agentId];
        if (nextAgentId && !aiOutput.startsWith("AI Service Error")) {
            const nextBotToken = BOT_TOKENS[nextAgentId];
            const nextBot = new Telegraf(nextBotToken);
            try {
                await nextBot.telegram.sendMessage(ctx.chat.id, `Input for ${nextAgentId} (from ${agentId}):\n\n${aiOutput}`);
                await ctx.reply(`Forwarded to ${nextAgentId}.`);
            } catch (err) {
                console.error(`Failed to forward to ${nextAgentId}:`, err.message);
                await ctx.reply(`Error: Could not forward to ${nextAgentId}.`);
            }
        }
    });

    bot.launch().then(() => console.log(`${agentId} launched`)).catch(err => console.error(`${agentId} launch failed:`, err.message));
});

process.once('SIGINT', () => Object.values(bots).forEach(bot => bot.stop('SIGINT')));
process.once('SIGTERM', () => Object.values(bots).forEach(bot => bot.stop('SIGTERM')));
