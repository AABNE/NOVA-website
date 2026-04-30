from flask import Flask, request, jsonify
from flask_cors import CORS
import urllib.request
import json

app = Flask(__name__)
CORS(app)

OLLAMA_API_KEY = "e3023131761f4713ad4d92f9ad8cb41f.hQ8u51Wq_H_dwAx5KanEZbYu"

@app.route("/")
def index():
    return open("nova.html", encoding="utf-8").read()
@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.json
        payload = json.dumps({
            "model": data["model"],
            "messages": data["messages"],
            "stream": False
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://ollama.com/api/chat",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OLLAMA_API_KEY}"
            },
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=60) as r:
            result = json.loads(r.read().decode("utf-8"))
            return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5000)