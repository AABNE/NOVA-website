import { Router } from "express";
import type { Request, Response } from "express";
import { getMessages, saveMessage } from "./auth";

const router = Router();

const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gpt-oss:120b";

router.get("/history", async (req: Request, res: Response) => {
  const sess = req.session as Record<string, unknown>;
  if (!sess?.user_id) { res.json([]); return; }
  try {
    const messages = await getMessages(sess.user_id as string);
    res.json(messages);
  } catch (e) {
    req.log.error({ err: e }, "History fetch error");
    res.json([]);
  }
});

router.post("/chat", async (req: Request, res: Response) => {
  const sess = req.session as Record<string, unknown>;
  if (!sess?.user_id) { res.status(401).json({ error: "Not logged in" }); return; }

  try {
    const { messages, model } = req.body as { messages: Array<{ role: string; content: string }>; model?: string };

    const userMessage = [...messages].reverse().find((m) => m.role === "user")?.content;
    if (userMessage) {
      await saveMessage(sess.user_id as string, "user", userMessage);
    }

    const ollamaRes = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || OLLAMA_MODEL,
        messages,
        stream: false,
      }),
    });

    if (!ollamaRes.ok) {
      const errBody = await ollamaRes.text();
      req.log.error({ status: ollamaRes.status, body: errBody }, "Ollama API error");
      res.status(500).json({ error: `HTTP ${ollamaRes.status}: ${errBody}` });
      return;
    }

    const result = await ollamaRes.json() as { message: { content: string } };
    const reply = result.message.content;
    await saveMessage(sess.user_id as string, "assistant", reply);

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Chat error");
    res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
});

export default router;
