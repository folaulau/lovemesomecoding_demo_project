"""Why did THAT listing come first? — `_explain` and the relevance knobs, on real data.

    python -m scripts.explain_search cabin
    python -m scripts.explain_search "san francisco loft"

A relevance complaint is never settled by opinion. `_explain` returns the arithmetic Elasticsearch
did for one document and one query, and every tuning decision is a change to one of those numbers.

What the sections below show, in order:
  1. the ranking, with each hit's score
  2. the BM25 breakdown for the top hit — boost x idf x tf
  3. what the field boosts in `queries._text_clause` are actually worth
  4. `function_score`: how "newer" or "better rated" gets folded into a text score
"""

import sys

from app.schemas.search import SearchRequest
from app.search.client import get_es
from app.search.queries import build_query, index_name

es = get_es()


def flatten(node: dict, depth: int = 0, out: list | None = None) -> list:
    """`_explain` returns a tree. The leaves are the numbers that matter."""
    out = [] if out is None else out
    out.append((depth, node["value"], node["description"]))
    for child in node.get("details", []):
        flatten(child, depth + 1, out)
    return out


def show_explain(doc_id: str, query: dict, *, limit: int = 14) -> None:
    result = es.explain(index=index_name(), id=doc_id, body={"query": query})
    for depth, value, description in flatten(result["explanation"])[:limit]:
        print(f"    {'  ' * depth}{value:>10.4f}  {description[:88]}")


def main() -> None:
    term = sys.argv[1] if len(sys.argv) > 1 else "cabin"
    req = SearchRequest(q=term)
    body = build_query(req, with_facets=False)
    query = body["query"]

    print(f"query: {term!r}\n")

    print("1. the ranking")
    raw = es.search(index=index_name(), body=body)
    hits = raw["hits"]["hits"]
    if not hits:
        print("  no hits — nothing to explain. Try `python -m scripts.analyze_demo` first.")
        return
    for hit in hits:
        print(f"  {hit['_score']:7.4f}  {hit['_source']['title'][:50]:52} {hit['_source']['city']}")
    top = hits[0]

    print(f"\n2. why {top['_source']['title']!r} scored {top['_score']:.4f}")
    print("   boost x idf x tf. `idf` is rarity — a term in 1 of 12 documents is worth more than")
    print("   one in 11. `tf` saturates: the fifth 'cabin' in a description adds almost nothing.")
    print("   ⚠️ `boost` will not be the number you wrote. Lucene folds BM25's (k1 + 1) = 2.2 into")
    print("      it, so `title^2` shows as 4.4. The ratio between fields is what you control.")
    show_explain(top["_id"], query)

    print("\n3. what the field boosts are worth")
    print("   `city^3, title^2, description` — the same term, scored once per field.")
    for field, boost in (("city", 3), ("title", 2), ("description", 1)):
        single = {"match": {field: {"query": term}}}
        r = es.search(index=index_name(), body={"query": single, "size": 3, "_source": ["title", "city"]})
        top_score = r["hits"]["hits"][0]["_score"] if r["hits"]["hits"] else 0.0
        print(f"  {field:12} ^{boost}  best unboosted score {top_score:7.4f}  -> boosted {top_score * boost:7.4f}")
    print("   multi_match `best_fields` (the default) takes the BEST field's score, not the sum —")
    print("   so a boost decides WHICH field wins, it does not add fields together.")

    print("\n4. function_score — folding rating into relevance")
    print("   Text relevance alone will rank a barely-reviewed listing above a great one. A")
    print("   `field_value_factor` multiplies the text score by something about the document.")
    fs = {
        "function_score": {
            "query": query,
            "field_value_factor": {
                # `log1p` rather than the raw value: linear on a 0-5 rating makes rating the only
                # thing that matters and text a tie-break, which is the usual overcorrection.
                "field": "rating_average",
                "modifier": "log1p",
                "factor": 2.0,
                # A listing with no reviews yet must not score zero and vanish.
                "missing": 1.0,
            },
            "boost_mode": "multiply",
        }
    }
    r = es.search(index=index_name(), body={"query": fs, "size": 5, "_source": ["title", "rating_average"]})
    for hit in r["hits"]["hits"]:
        src = hit["_source"]
        print(f"  {hit['_score']:7.4f}  rating {src['rating_average']:4}  {src['title'][:50]}")


if __name__ == "__main__":
    main()
