"""Score news headlines with FinBERT (ProsusAI/finbert, a BERT model fine-tuned on financial text).

    pip install -r requirements-ml.txt        # torch + transformers (optional; not needed to run the app)
    python -m backend.sentiment               # scores every article still marked 'unscored'

Uses only sqlite3 + transformers, so it can run from any environment that already has PyTorch.
Each article gets sentiment = positive / negative / neutral and the model's confidence; low-confidence
predictions (< 0.55) are stored as neutral so weak signals are not presented as strong ones.
"""
import argparse
import json
import os
import sqlite3
from pathlib import Path

MODEL = "ProsusAI/finbert"
MIN_CONFIDENCE = 0.55
DEFAULT_DB = Path(__file__).resolve().parents[1] / "data" / "stocklens-real.db"


def label(probabilities, labels):
    best = max(range(len(labels)), key=lambda i: probabilities[i])
    sentiment, confidence = labels[best].lower(), float(probabilities[best])
    return ("neutral" if confidence < MIN_CONFIDENCE else sentiment), round(confidence, 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=os.getenv("STOCKLENS_SQLITE", str(DEFAULT_DB)))
    ap.add_argument("--all", action="store_true", help="re-score every article, not only unscored ones")
    args = ap.parse_args()

    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL).eval()
    labels = [model.config.id2label[i] for i in range(model.config.num_labels)]

    con = sqlite3.connect(args.db)
    where = "" if args.all else " WHERE sentiment='unscored'"
    rows = con.execute(f"SELECT id, headline, body FROM articles{where}").fetchall()
    counts = {}
    for start in range(0, len(rows), 16):
        batch = rows[start:start + 16]
        texts = [h if not b or b == h else f"{h}. {b}" for _, h, b in batch]
        enc = tok(texts, padding=True, truncation=True, max_length=128, return_tensors="pt")
        with torch.inference_mode():
            probs = torch.softmax(model(**enc).logits, dim=-1).tolist()
        for (aid, _, _), p in zip(batch, probs):
            sentiment, conf = label(p, labels)
            counts[sentiment] = counts.get(sentiment, 0) + 1
            takeaway = f"FinBERT: {sentiment} ({conf:.0%} confidence). Automated tone of the headline, not a judgement of the company."
            con.execute("UPDATE articles SET sentiment=?, takeaway=? WHERE id=?", (sentiment, takeaway, aid))
    con.commit()
    print(json.dumps({"scored": len(rows), "by_sentiment": counts, "model": MODEL}))


if __name__ == "__main__":
    main()
