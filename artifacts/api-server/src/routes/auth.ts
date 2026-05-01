import { Router } from "express";
import type { Request, Response } from "express";
import crypto from "crypto";

const router = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.REDIRECT_URI;
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

function getRedirectUri(req: Request): string {
  if (REDIRECT_URI) return REDIRECT_URI;
  const proto = req.protocol;
  const host = req.get("host") || "localhost";
  return `${proto}://${host}/api/callback`;
}

async function supabaseRequest(method: string, path: string, data?: unknown) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) return [];
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

export async function upsertUser(userId: string, username: string, avatar: string) {
  await supabaseRequest("POST", "users?on_conflict=id", {
    id: userId,
    username,
    avatar,
    last_active: new Date().toISOString(),
  });
}

export async function getMessages(userId: string) {
  return await supabaseRequest("GET", `messages?user_id=eq.${userId}&order=created_at.asc`);
}

export async function saveMessage(userId: string, role: string, content: string) {
  await supabaseRequest("POST", "messages", { user_id: userId, role, content });
  await supabaseRequest("PATCH", `users?id=eq.${userId}`, { last_active: new Date().toISOString() });
}

router.get("/login", (req: Request, res: Response) => {
  const state = crypto.randomBytes(16).toString("hex");
  const sess = req.session as Record<string, unknown>;
  sess.oauth_state = state;
  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

router.get("/callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const returnedState = req.query.state as string;
  const sess = req.session as Record<string, unknown>;

  if (!code || !returnedState || returnedState !== sess.oauth_state) {
    res.redirect("/");
    return;
  }
  delete sess.oauth_state;

  const redirectUri = getRedirectUri(req);

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) { res.redirect("/"); return; }

    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const userData = await userRes.json() as { id: string; username: string; avatar?: string };

    const userId = userData.id;
    const username = userData.username;
    const avatar = userData.avatar
      ? `https://cdn.discordapp.com/avatars/${userId}/${userData.avatar}.png`
      : "";

    await upsertUser(userId, username, avatar);

    if (req.session) {
      (req.session as Record<string, unknown>).user_id = userId;
      (req.session as Record<string, unknown>).username = username;
      (req.session as Record<string, unknown>).avatar = avatar;
    }

    res.redirect("/");
  } catch (e) {
    req.log.error({ err: e }, "OAuth callback error");
    res.redirect("/");
  }
});

router.get("/logout", (req: Request, res: Response) => {
  req.session?.destroy(() => {
    res.redirect("/");
  });
});

router.get("/me", (req: Request, res: Response) => {
  const sess = req.session as Record<string, unknown>;
  if (!sess?.user_id) {
    res.json({ logged_in: false });
    return;
  }
  res.json({
    logged_in: true,
    user_id: sess.user_id,
    username: sess.username,
    avatar: sess.avatar,
  });
});

export default router;
