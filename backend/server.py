from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import chromadb
import os
import uuid
from pathlib import Path
import requests
from dotenv import load_dotenv

load_dotenv()
port = int(os.environ.get("PORT", 10000))
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

IMAGE_DIR = Path("images")
IMAGE_DIR.mkdir(exist_ok=True)

# Initialize ChromaDB
chroma_client = chromadb.PersistentClient(path="image_db")
collection = chroma_client.get_or_create_collection(
    name="image_embeddings",
    metadata={"hnsw:space": "cosine"}
)

embed_model = SentenceTransformer('all-MiniLM-L6-v2')

# interpret this as cosine‐similarity threshold, not distance
SIMILARITY_THRESHOLD = 0.80
STABILITY_API = "https://api.stability.ai/v2beta/stable-image/generate/core"

def _build_cors_preflight_response():
    response = jsonify({"status": "preflight"})
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "POST,OPTIONS")
    return response

@app.route('/images/<path:filename>')
def serve_image(filename):
    # Serve image and set CORS header
    response = make_response(send_from_directory(IMAGE_DIR, filename))
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response

@app.route('/api/generate-image', methods=['POST', 'OPTIONS'])
def handle_image_generation():
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    data = request.get_json()
    if not data:
        response = jsonify({"error": "Request body must be JSON"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 400
    
    prompt = data.get('prompt')
    if not prompt:
        response = jsonify({"error": "Prompt is required"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        return response, 400

    # 1) embed prompt
    prompt_emb = embed_model.encode(prompt).tolist()

    # 2) query for nearest
    q = collection.query(
        query_embeddings=[prompt_emb],
        n_results=1,
        include=["metadatas", "distances"]
    )
    has_hit = bool(q["distances"] and len(q["distances"][0])>0)
    if has_hit:
        dist = q["distances"][0][0]
        sim = 1.0 - dist
        print(f"[DEBUG] best distance = {dist:.4f}, similarity = {sim:.4f}")
        # only cache‐hit if similarity > threshold
        if sim > SIMILARITY_THRESHOLD:
            cached = q["metadatas"][0][0]["image_path"]
            print(f"[CACHE HIT] sim {sim:.4f} > {SIMILARITY_THRESHOLD} → {cached}")
            resp = jsonify({
                "imageUrl": f"/images/{cached}",
                "source": "cache",
                "cached": True,
                "similarity": sim
            })
            resp.headers.add("Access-Control-Allow-Origin", "*")
            return resp

    # 3) otherwise generate new
    print(f"[API CALL] sim {sim if has_hit else 'N/A'} ≤ {SIMILARITY_THRESHOLD}, generating new image")
    headers = {
        "Authorization": f"Bearer {os.getenv('STABILITY_API_KEY')}",
        "Accept": "image/*"
    }
    api_resp = requests.post(
        STABILITY_API,
        headers=headers,
        files={"prompt": (None, prompt), "output_format": (None, "webp")}
    )
    if api_resp.status_code != 200:
        err = jsonify({"error": "Failed to generate image from API"})
        err.headers.add("Access-Control-Allow-Origin", "*")
        return err, 500

    filename = f"{uuid.uuid4().hex}.webp"
    with open(IMAGE_DIR/filename, "wb") as f:
        f.write(api_resp.content)

    collection.add(
        embeddings=[prompt_emb],
        metadatas=[{"prompt": prompt, "image_path": filename}],
        ids=[str(uuid.uuid4())]
    )

    print(f"[API SUCCESS] new image saved as {filename}")
    resp = jsonify({
        "imageUrl": f"/images/{filename}",
        "source": "api",
        "cached": False,
        "similarity": sim if has_hit else None
    })
    resp.headers.add("Access-Control-Allow-Origin", "*")
    return resp

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=port)


