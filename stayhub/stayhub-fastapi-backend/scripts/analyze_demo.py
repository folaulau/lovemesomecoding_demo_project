"""Show what Elasticsearch actually stores, using the real StayHub analyzer.

    python -m scripts.analyze_demo

Nearly every "why does my search return nothing?" is the same bug: the analyzer that ran at INDEX
time and the analyzer that ran at QUERY time disagreed, so the terms never matched. `_analyze` is
the only way to see that, because the index stores tokens — not the text you gave it.

Everything printed here runs against the live cluster and the mapping in `app/search/index.py`.
"""

from app.search.client import get_es
from app.search.index import ALIAS

es = get_es()


def analyze(text: str, *, analyzer: str | None = None, field: str | None = None) -> list[str]:
    body: dict = {"text": text}
    if analyzer:
        body["analyzer"] = analyzer
    if field:
        body["field"] = field
    result = es.indices.analyze(index=ALIAS, body=body)
    return [t["token"] for t in result["tokens"]]


def row(label: str, tokens: list[str]) -> None:
    print(f"  {label:34} {tokens}")


def main() -> None:
    print(f"index: {ALIAS}\n")

    print("1. standard vs stayhub_text — what asciifolding buys")
    print("   The custom analyzer is `standard` + lowercase + asciifolding.\n")
    for text in ("Málaga", "Café Loft", "SAN FRANCISCO"):
        print(f"  {text!r}")
        row("standard", analyze(text, analyzer="standard"))
        row("stayhub_text", analyze(text, analyzer="stayhub_text"))
        print()

    print("2. the same field, two ways — `city` vs `city.raw`")
    print("   This is why aggregations use `city.raw` and matching uses `city`.\n")
    row("field=city (text)", analyze("San Francisco", field="city"))
    row("field=city.raw (keyword)", analyze("San Francisco", field="city.raw"))
    print()

    print("3. the failure this exists to explain")
    print("   A guest types 'malaga'. The index holds 'Málaga'.\n")
    indexed = analyze("Málaga", analyzer="stayhub_text")
    typed = analyze("malaga", analyzer="stayhub_text")
    row("indexed as", indexed)
    row("query becomes", typed)
    print(f"  {'match?':34} {set(indexed) & set(typed) != set()}")
    print()
    indexed_std = analyze("Málaga", analyzer="standard")
    typed_std = analyze("malaga", analyzer="standard")
    row("without asciifolding, indexed", indexed_std)
    row("without asciifolding, query", typed_std)
    print(f"  {'match?':34} {set(indexed_std) & set(typed_std) != set()}")
    print()

    print("4. the tokenizer decides the units, the filters only reshape them")
    row("standard", analyze("wi-fi enabled loft #2", analyzer="standard"))
    row("keyword (one token, always)", analyze("wi-fi enabled loft #2", analyzer="keyword"))
    row("whitespace", analyze("wi-fi enabled loft #2", analyzer="whitespace"))


if __name__ == "__main__":
    main()
