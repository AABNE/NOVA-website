import { useState, useEffect, useRef, useCallback } from "react";

const OLLAMA_MODEL = "gpt-oss:120b";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

interface Message {
  role: "user" | "clarixs";
  content: string;
}

interface User {
  logged_in: boolean;
  user_id?: string;
  username?: string;
  avatar?: string;
}

interface HistoryEntry {
  role: string;
  content: string;
}

function escHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatClarixs(text: string): string {
  if (text.startsWith("IMAGE:")) {
    const prompt = text.slice(6).split("\n")[0].trim();
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}`;
    return `<div class="tag-label tag-image" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">🎨 Image</div><img src="${url}" alt="${prompt}" loading="lazy" style="max-width:100%;border-radius:10px;margin-top:8px;display:block;"/>`;
  }
  if (text.startsWith("CODE:")) {
    const lines = text.split("\n");
    const lang = lines[0].slice(5).trim();
    const code: string[] = [];
    const explanation: string[] = [];
    let inCode = true;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "END_CODE") { inCode = false; continue; }
      if (inCode) code.push(lines[i]);
      else explanation.push(lines[i]);
    }
    const exp = explanation.join("\n").trim();
    return `<div class="tag-label tag-code" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">💻 ${lang || "Code"}</div><pre style="background:#060a10;border:1px solid #1a2230;border-radius:8px;padding:14px;overflow-x:auto;margin-top:8px;font-size:13px;line-height:1.6;"><code style="font-family:'DM Mono',monospace;color:#00e5ff;">${escHtml(code.join("\n"))}</code></pre>${exp ? `<br>${escHtml(exp)}` : ""}`;
  }
  if (text.startsWith("MATH:")) return `<div class="tag-label tag-math" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">🧮 Math</div> ${escHtml(text.slice(5).trim())}`;
  if (text.startsWith("MUSIC:")) return `<div class="tag-label tag-music" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">🎵 Playlist</div> ${escHtml(text.slice(6).trim())}`;
  if (text.startsWith("JOKE:")) return `<div class="tag-label tag-joke" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">😂 Joke</div> ${escHtml(text.slice(5).trim())}`;
  if (text.startsWith("RECIPE:")) return `<div class="tag-label tag-recipe" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">🍳 Recipe</div> ${escHtml(text.slice(7).trim())}`;
  if (text.startsWith("TRANSLATE:")) return `<div class="tag-label tag-advice" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">🌍 Translation</div> ${escHtml(text.slice(10).trim())}`;
  if (text.startsWith("ADVICE:")) return `<div class="tag-label tag-advice" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">💡 Advice</div> ${escHtml(text.slice(7).trim())}`;
  if (text.startsWith("STORY:")) return `<div class="tag-label tag-story" style="display:inline-block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;padding:3px 8px;border-radius:4px;margin-bottom:8px;font-weight:500;">📖 Story</div> ${escHtml(text.slice(6).trim())}`;
  return escHtml(text).replace(/\n/g, "<br>");
}

function ChatMessage({ message, user }: { message: Message; user: User | null }) {
  const isClarixs = message.role === "clarixs";

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        maxWidth: "780px",
        animation: "fadeUp 0.3s ease forwards",
        opacity: 0,
        alignSelf: isClarixs ? "flex-start" : "flex-end",
        flexDirection: isClarixs ? "row" : "row-reverse",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: "13px",
          background: isClarixs
            ? "linear-gradient(135deg, #00e5ff, #7b2fff)"
            : "#1a2230",
          color: isClarixs ? "#000" : "#5a6a7a",
          boxShadow: isClarixs ? "0 0 15px rgba(0,229,255,0.2)" : "none",
          overflow: "hidden",
        }}
      >
        {isClarixs ? (
          "C"
        ) : user?.avatar ? (
          <img src={user.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        ) : (
          "U"
        )}
      </div>
      <div
        style={{
          padding: "14px 18px",
          borderRadius: "14px",
          fontSize: "14px",
          lineHeight: 1.7,
          maxWidth: "680px",
          wordBreak: "break-word",
          background: isClarixs ? "var(--clarixs-bubble)" : "var(--user-bubble)",
          border: "1px solid var(--border)",
          borderTopLeftRadius: isClarixs ? "4px" : "14px",
          borderTopRightRadius: isClarixs ? "14px" : "4px",
          color: "var(--text)",
        }}
        {...(isClarixs
          ? { dangerouslySetInnerHTML: { __html: formatClarixs(message.content) } }
          : { children: message.content })}
      />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "12px", maxWidth: "780px", alignSelf: "flex-start" }}>
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          background: "linear-gradient(135deg, #00e5ff, #7b2fff)",
          color: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: "13px",
          flexShrink: 0,
        }}
      >
        C
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "14px 18px",
          background: "var(--clarixs-bubble)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          borderTopLeftRadius: "4px",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--accent)",
              animation: `typingBounce 1.2s infinite ${i * 0.2}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${API}/me`, { credentials: "include" });
        const data: User = await res.json();
        if (data.logged_in) {
          setUser(data);
          setHistory([
            {
              role: "system",
              content: `You are Clarixs, a jack of all trades AI assistant on a website.
You were created by AussieAviationBNE.
The person talking to you is ${data.username}.
${data.username} is NOT your creator — AussieAviationBNE made you.
If asked who made you say AussieAviationBNE.
Never say you were made by Meta, Groq, OpenAI, Ollama or anyone else.
Do NOT introduce yourself every message, only the first time.

Tags to use at the start of your reply:
IMAGE: <detailed prompt> → user wants an image
CODE: <lang>\n<code>\nEND_CODE\n<explanation> → user wants code
MATH: <solution> → math problem
MUSIC: <songs> → song recommendations
JOKE: <joke> → user wants a joke
RECIPE: <steps> → cooking question
TRANSLATE: <translation> → translate something
ADVICE: <advice> → life advice
STORY: <story> → creative writing
For anything else reply normally.`,
            },
          ]);
          try {
            const histRes = await fetch(`${API}/history`, { credentials: "include" });
            const histData: HistoryEntry[] = await histRes.json();
            if (histData.length > 0) {
              setShowWelcome(false);
              const msgs: Message[] = [];
              const newHistory: HistoryEntry[] = [
                {
                  role: "system",
                  content: `You are Clarixs, a jack of all trades AI assistant on a website.
You were created by AussieAviationBNE.
The person talking to you is ${data.username}.
${data.username} is NOT your creator — AussieAviationBNE made you.
If asked who made you say AussieAviationBNE.
Never say you were made by Meta, Groq, OpenAI, Ollama or anyone else.
Do NOT introduce yourself every message, only the first time.

Tags to use at the start of your reply:
IMAGE: <detailed prompt> → user wants an image
CODE: <lang>\n<code>\nEND_CODE\n<explanation> → user wants code
MATH: <solution> → math problem
MUSIC: <songs> → song recommendations
JOKE: <joke> → user wants a joke
RECIPE: <steps> → cooking question
TRANSLATE: <translation> → translate something
ADVICE: <advice> → life advice
STORY: <story> → creative writing
For anything else reply normally.`,
                },
              ];
              for (const msg of histData) {
                if (msg.role === "system") continue;
                msgs.push({ role: msg.role === "user" ? "user" : "clarixs", content: msg.content });
                newHistory.push({ role: msg.role, content: msg.content });
              }
              setMessages(msgs);
              setHistory(newHistory);
            }
          } catch {
            // ignore history errors
          }
        } else {
          setUser({ logged_in: false });
        }
      } catch {
        setUser({ logged_in: false });
      }
    }
    init();
  }, []);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isProcessing || !user?.logged_in) return;

    setShowWelcome(false);
    setIsProcessing(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const newUserMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, newUserMsg]);

    const newHistory = [...history, { role: "user", content: text }];
    setHistory(newHistory);
    setIsTyping(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages: newHistory }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const reply = data.message.content.trim();
      setHistory((prev) => [...prev, { role: "assistant", content: reply }]);
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: "clarixs", content: reply }]);
    } catch (err: unknown) {
      setIsTyping(false);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => [...prev, { role: "clarixs", content: `⚠️ Error: ${errorMsg}` }]);
    }

    setIsProcessing(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestion = (text: string) => {
    if (!user?.logged_in) return;
    setInput(text.slice(2).trim());
    textareaRef.current?.focus();
  };

  const suggestions = [
    "🎨 Draw a futuristic city",
    "💻 Write a Python script",
    "😂 Tell me a joke",
    "🍳 How do I make pasta?",
    "🎵 Give me chill songs",
    "🌍 Translate \"hello\" to Japanese",
  ];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Animated background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 20% 20%, rgba(0,229,255,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 80%, rgba(123,47,255,0.05) 0%, transparent 60%)
          `,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 28px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(8,11,15,0.9)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #00e5ff, #7b2fff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Syne', sans-serif",
              fontWeight: 800,
              fontSize: "16px",
              color: "#000",
              boxShadow: "0 0 20px rgba(0,229,255,0.3)",
            }}
          >
            C
          </div>
          <div>
            <div
              style={{
                fontFamily: "'Syne', sans-serif",
                fontWeight: 800,
                fontSize: "20px",
                letterSpacing: "-0.5px",
                background: "linear-gradient(90deg, #00e5ff, #7b2fff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Clarixs
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user?.logged_in && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {user.avatar && (
                <img src={user.avatar} style={{ width: "30px", height: "30px", borderRadius: "50%", border: "2px solid var(--border)" }} alt="" />
              )}
              <span style={{ fontSize: "13px", color: "var(--text-dim)" }}>{user.username}</span>
              <a
                href={`${API}/logout`}
                style={{ fontSize: "12px", color: "var(--text-dim)", textDecoration: "none", padding: "5px 10px", border: "1px solid var(--border)", borderRadius: "6px" }}
              >
                Logout
              </a>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-dim)" }}>
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#00ff88",
                boxShadow: "0 0 8px #00ff88",
                animation: "pulse 2s infinite",
              }}
            />
            Online
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div
        ref={chatRef}
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          overflowY: "auto",
          padding: "28px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          scrollBehavior: "smooth",
        }}
      >
        {showWelcome && (
          <div style={{ textAlign: "center", padding: "60px 20px", animation: "fadeUp 0.5s ease forwards" }}>
            <h1
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "42px",
                fontWeight: 800,
                background: "linear-gradient(90deg, #00e5ff, #7b2fff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                marginBottom: "12px",
              }}
            >
              Hey, I'm Clarixs
            </h1>

            {user?.logged_in ? (
              <>
                <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "32px", lineHeight: 1.7 }}>
                  Your jack of all trades AI assistant.<br />
                  Ask me anything — I can chat, code, draw, joke, translate, and more.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", maxWidth: "600px", margin: "0 auto" }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestion(s)}
                      style={{
                        padding: "9px 16px",
                        border: "1px solid var(--border)",
                        borderRadius: "20px",
                        fontSize: "13px",
                        color: "var(--text-dim)",
                        cursor: "pointer",
                        background: "var(--surface)",
                        fontFamily: "'DM Mono', monospace",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.3)";
                        (e.target as HTMLButtonElement).style.color = "var(--accent)";
                        (e.target as HTMLButtonElement).style.background = "rgba(0,229,255,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.borderColor = "var(--border)";
                        (e.target as HTMLButtonElement).style.color = "var(--text-dim)";
                        (e.target as HTMLButtonElement).style.background = "var(--surface)";
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ color: "var(--text-dim)", fontSize: "14px", marginBottom: "32px", lineHeight: 1.7 }}>
                  Your jack of all trades AI assistant.<br />
                  Login with Discord to start chatting and sync your conversations.
                </p>
                <a
                  href={`${API}/login`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "14px 28px",
                    borderRadius: "12px",
                    background: "#5865F2",
                    color: "white",
                    textDecoration: "none",
                    fontFamily: "'Syne', sans-serif",
                    fontWeight: 700,
                    fontSize: "15px",
                    marginTop: "16px",
                    boxShadow: "0 0 20px rgba(88,101,242,0.3)",
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 71 55" fill="white">
                    <path d="M60.1 4.9A58.5 58.5 0 0 0 45.5.4a40.6 40.6 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0A38.7 38.7 0 0 0 25.6.4 58.4 58.4 0 0 0 11 5C1.6 19.1-1 32.8.3 46.4a58.9 58.9 0 0 0 18 9.1 44.3 44.3 0 0 0 3.8-6.2 38.4 38.4 0 0 1-6-2.9l1.5-1.1a41.9 41.9 0 0 0 36 0l1.5 1.1a38.3 38.3 0 0 1-6 2.9 44 44 0 0 0 3.8 6.2 58.7 58.7 0 0 0 18-9.1C72.2 30.6 68 17 60.1 4.9ZM23.7 38.1c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.5 3.3 6.4 7.2c0 4-2.8 7.2-6.4 7.2Zm23.6 0c-3.5 0-6.4-3.2-6.4-7.2s2.8-7.2 6.4-7.2 6.5 3.3 6.4 7.2c0 4-2.8 7.2-6.4 7.2Z" />
                  </svg>
                  Login with Discord
                </a>
              </>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} user={user} />
        ))}

        {isTyping && <TypingIndicator />}
      </div>

      {/* Input area */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "16px 20px",
          borderTop: "1px solid var(--border)",
          background: "rgba(8,11,15,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "12px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            padding: "12px 16px",
            maxWidth: "860px",
            margin: "0 auto",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoResize(); }}
            onKeyDown={handleKeyDown}
            placeholder={user?.logged_in ? "Message Clarixs..." : "Login with Discord to chat..."}
            disabled={!user?.logged_in || isProcessing}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontFamily: "'DM Mono', monospace",
              fontSize: "14px",
              lineHeight: 1.6,
              resize: "none",
              maxHeight: "160px",
              minHeight: "24px",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!user?.logged_in || isProcessing || !input.trim()}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #00e5ff, #7b2fff)",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 15px rgba(0,229,255,0.2)",
              opacity: (!user?.logged_in || isProcessing || !input.trim()) ? 0.4 : 1,
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px", fill: "#000" }}>
              <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
            </svg>
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-dim)", marginTop: "10px", letterSpacing: "0.5px" }}>
          Clarixs can make mistakes. Use your judgment.
        </div>
      </div>
    </div>
  );
}
