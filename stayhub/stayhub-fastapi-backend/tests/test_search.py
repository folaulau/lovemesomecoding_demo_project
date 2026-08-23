"""The search query builder, and the parts of it that only real Elasticsearch can prove.

Two groups. The first builds query bodies and asserts on their shape — no cluster, always runs.
The second indexes a handful of known documents into a throwaway index and asserts on what comes
back, because the interesting claims in `app/search/queries.py` are all claims about behaviour:
`cross_fields` matches across fields and `best_fields` does not, a facet that includes its own
filter collapses, `encoder: html` is what stops a highlight being an XSS hole. None of those can
be verified by reading a dict.

The second group skips when Elasticsearch is not running, the same way `test_cache.py` skips
without Redis.
"""

import uuid

import pytest

from app.schemas.search import SearchRequest
from app.search.client import es_available, get_es
from app.search.index import INDEX_SETTINGS
from app.search.queries import TEXT_FIELDS, build_aggs, build_query, to_response

es_required = pytest.mark.skipif(
    not es_available(), reason="Elasticsearch is not running — `docker compose up -d elasticsearch`"
)


# ---------------------------------------------------------------------------
# Query construction — no cluster needed
# ---------------------------------------------------------------------------


class TestTextClause:
    def test_no_query_is_match_all(self):
        must = build_query(SearchRequest())["query"]["bool"]["must"]
        assert must == [{"match_all": {}}]

    def test_query_pairs_cross_fields_with_a_fuzzy_clause(self):
        """Both, because neither alone is right — see `_text_clause`."""
        clause = build_query(SearchRequest(q="loft"))["query"]["bool"]["must"][0]
        should = clause["bool"]["should"]
        assert clause["bool"]["minimum_should_match"] == 1
        assert [s["multi_match"].get("type") for s in should] == ["cross_fields", None]
        # cross_fields must NOT carry fuzziness: Elasticsearch rejects the combination outright.
        assert "fuzziness" not in should[0]["multi_match"]
        assert should[1]["multi_match"]["fuzziness"] == "AUTO"
        assert all(s["multi_match"]["fields"] == TEXT_FIELDS for s in should)


class TestFilters:
    def _filters(self, **kw):
        return build_query(SearchRequest(**kw))["query"]["bool"]["filter"]

    def test_amenities_and_together(self):
        """Two ticked boxes mean "both", so two `term` clauses — not one `terms`, which is OR."""
        filters = self._filters(amenities=["wifi", "parking"])
        assert filters == [{"term": {"amenities": "wifi"}}, {"term": {"amenities": "parking"}}]

    def test_price_range_is_one_clause_from_two_bounds(self):
        assert self._filters(min_price=100, max_price=250) == [
            {"range": {"price_per_night": {"gte": 100.0, "lte": 250.0}}}
        ]

    def test_geo_needs_both_coordinates(self):
        """Half a coordinate has to mean "no geo" — `lon: 0` is the Gulf of Guinea, not a default."""
        assert self._filters(lat=37.7, radius_km=10) == []
        assert self._filters(lon=-122.4, radius_km=10) == []

    def test_geo_needs_a_radius(self):
        """Coordinates without a radius still produce distances, but filter nothing."""
        assert self._filters(lat=37.7, lon=-122.4) == []

    def test_geo_distance_filter(self):
        assert self._filters(lat=37.7, lon=-122.4, radius_km=25) == [
            {"geo_distance": {"distance": "25.0km", "location": {"lat": 37.7, "lon": -122.4}}}
        ]


class TestSort:
    def test_relevance_has_no_sort_key(self):
        assert "sort" not in build_query(SearchRequest())

    def test_rating_breaks_ties_on_review_count(self):
        assert build_query(SearchRequest(sort="rating"))["sort"] == [
            {"rating_average": "desc"},
            {"rating_count": "desc"},
        ]

    def test_distance_sort_is_primary(self):
        sort = build_query(SearchRequest(lat=37.7, lon=-122.4, sort="distance"))["sort"]
        assert list(sort[0]) == ["_geo_distance"]

    def test_coordinates_without_distance_sort_keep_score_first(self):
        """The geo entry is there to READ the distance off each hit, not to reorder them.

        Without the explicit `_score`, a bare `[_geo_distance]` would silently turn a relevance
        search into a proximity search.
        """
        sort = build_query(SearchRequest(q="loft", lat=37.7, lon=-122.4))["sort"]
        assert sort[0] == "_score"
        assert list(sort[1]) == ["_geo_distance"]


class TestHighlightAndFacets:
    def test_highlight_only_when_there_is_a_term_to_mark(self):
        assert "highlight" not in build_query(SearchRequest())
        assert "highlight" in build_query(SearchRequest(q="loft"))

    def test_highlight_escapes_the_source(self):
        """`encoder: html` is what keeps a description containing <script> from being returned
        as a live tag inside a fragment the frontend renders as HTML."""
        assert build_query(SearchRequest(q="loft"))["highlight"]["encoder"] == "html"

    def test_facets_can_be_turned_off(self):
        assert "aggs" not in build_query(SearchRequest(), with_facets=False)

    def test_each_facet_drops_its_own_filter(self):
        """The whole point of `build_aggs`. Count a facet inside its own filter and the panel
        collapses to the one value already selected."""
        req = SearchRequest(property_type="CABIN", amenities=["wifi"], min_price=100)
        aggs = build_aggs(req)["facets"]["aggs"]

        def clauses(facet):
            return aggs[facet]["filter"]["bool"]["filter"]

        assert {"term": {"property_type": "CABIN"}} not in clauses("property_types")
        assert {"term": {"property_type": "CABIN"}} in clauses("amenities")
        assert {"term": {"amenities": "wifi"}} not in clauses("amenities")
        assert {"term": {"amenities": "wifi"}} in clauses("property_types")
        assert not any("price_per_night" in str(c) for c in clauses("price_ranges"))

    def test_facets_escape_the_main_query_with_global(self):
        assert build_aggs(SearchRequest())["facets"]["global"] == {}

    def test_city_facet_uses_the_keyword_multi_field(self):
        """`city` is analysed — its terms are "san" and "francisco". Aggregations run on terms."""
        aggs = build_aggs(SearchRequest())["facets"]["aggs"]
        assert aggs["cities"]["aggs"]["buckets"]["terms"]["field"] == "city.raw"


# ---------------------------------------------------------------------------
# Against a real cluster
# ---------------------------------------------------------------------------

DOCS = [
    {
        "public_id": str(uuid.uuid4()),
        "title": "Sunlit Loft in the Mission",
        "description": "A bright corner loft two blocks from Dolores Park.",
        "city": "San Francisco", "state": "CA", "country": "US",
        "property_type": "LOFT", "room_type": "ENTIRE_PLACE", "status": "PUBLISHED",
        "amenities": ["wifi", "kitchen"],
        "price_per_night": 250.0, "cleaning_fee": 40.0, "max_guests": 4,
        "bedrooms": 1, "beds": 2, "bathrooms": 1.0, "rating_average": 4.8, "rating_count": 61,
        "latitude": 37.7599, "longitude": -122.4148,
        "location": {"lat": 37.7599, "lon": -122.4148},
        "created_at": "2026-01-05T00:00:00",
    },
    {
        "public_id": str(uuid.uuid4()),
        "title": "Cedar Cabin with Mountain Views",
        "description": "Quiet retreat with a <script>alert(1)</script> wood stove.",
        "city": "Big Bear Lake", "state": "CA", "country": "US",
        "property_type": "CABIN", "room_type": "ENTIRE_PLACE", "status": "PUBLISHED",
        "amenities": ["wifi", "hot-tub"],
        "price_per_night": 180.0, "cleaning_fee": 30.0, "max_guests": 6,
        "bedrooms": 2, "beds": 3, "bathrooms": 2.0, "rating_average": 4.9, "rating_count": 12,
        "latitude": 34.2439, "longitude": -116.9114,
        "location": {"lat": 34.2439, "lon": -116.9114},
        "created_at": "2026-02-05T00:00:00",
    },
    {
        "public_id": str(uuid.uuid4()),
        "title": "Old Town Apartment",
        "description": "Steps from the cathedral.",
        "city": "Málaga", "state": None, "country": "ES",
        "property_type": "APARTMENT", "room_type": "ENTIRE_PLACE", "status": "PUBLISHED",
        "amenities": ["kitchen"],
        "price_per_night": 90.0, "cleaning_fee": 15.0, "max_guests": 2,
        "bedrooms": 1, "beds": 1, "bathrooms": 1.0, "rating_average": 4.6, "rating_count": 30,
        "latitude": 36.7213, "longitude": -4.4214,
        "location": {"lat": 36.7213, "lon": -4.4214},
        "created_at": "2026-03-05T00:00:00",
    },
]


@pytest.fixture(scope="module")
def index() -> str:
    """A throwaway index with the REAL mapping, so analysis and multi-fields behave as in prod."""
    es = get_es()
    name = f"test-stayhub-{uuid.uuid4().hex[:8]}"
    es.indices.create(index=name, body=INDEX_SETTINGS)
    for doc in DOCS:
        es.index(index=name, id=doc["public_id"], document=doc)
    es.indices.refresh(index=name)
    yield name
    es.options(ignore_status=404).indices.delete(index=name)


def run(index: str, **kw):
    req = SearchRequest(**kw)
    raw = get_es().search(index=index, body=build_query(req))
    return to_response(raw.body if hasattr(raw, "body") else dict(raw), req)


@es_required
class TestAgainstCluster:
    def test_cross_fields_finds_terms_split_across_fields(self, index):
        """The bug the hybrid clause exists to fix. "san francisco" is in `city`, "loft" is in
        `title`, and `best_fields` + `operator: and` needs every term in ONE field."""
        assert [h.title for h in run(index, q="san francisco loft").hits] == ["Sunlit Loft in the Mission"]

        best_fields_only = {
            "multi_match": {"query": "san francisco loft", "fields": TEXT_FIELDS, "operator": "and"}
        }
        raw = get_es().search(index=index, body={"query": best_fields_only})
        assert raw["hits"]["total"]["value"] == 0

    def test_typos_still_match(self, index):
        assert [h.title for h in run(index, q="cabbin").hits] == ["Cedar Cabin with Mountain Views"]

    def test_asciifolding_matches_an_unaccented_query(self, index):
        """`stayhub_text` folds accents, so a guest who cannot type "Málaga" still finds it."""
        assert [h.city for h in run(index, q="malaga").hits] == ["Málaga"]

    def test_highlights_are_escaped(self, index):
        """The claim in `_highlight_spec`: without `encoder: html` this fragment would come back
        with a live <script> tag in it."""
        hit = run(index, q="wood stove").hits[0]
        fragment = hit.highlights["description"][0]
        assert "<script>" not in fragment
        assert "&lt;script&gt;" in fragment
        assert "<mark>" in fragment

    def test_facet_does_not_collapse_under_its_own_filter(self, index):
        """Ticking CABIN narrows the results to one, but the type list must still offer the
        others — otherwise the guest can never switch without clearing the filter."""
        result = run(index, property_type="CABIN")
        assert result.total == 1
        assert {b.key for b in result.facets.property_types} == {"LOFT", "CABIN", "APARTMENT"}

    def test_other_facets_do_narrow(self, index):
        """The flip side: every OTHER facet is counted with the CABIN filter applied, because
        "how many results if I also pick this" is the question a filter panel answers."""
        result = run(index, property_type="CABIN")
        assert {b.key for b in result.facets.cities} == {"Big Bear Lake"}

    def test_price_stats_cover_the_whole_catalogue(self, index):
        stats = run(index).facets.price
        assert float(stats.min) == 90.0
        assert float(stats.max) == 250.0

    def test_geo_distance_filters_and_sorts(self, index):
        """From San Francisco: the Mission loft is next door, Big Bear is ~600km, Málaga is a
        different continent."""
        result = run(index, lat=37.7749, lon=-122.4194, radius_km=50, sort="distance")
        assert [h.city for h in result.hits] == ["San Francisco"]
        assert result.hits[0].distance_km < 5

    def test_distance_is_reported_without_reordering(self, index):
        """Coordinates with the default relevance sort: distances present, ranking untouched."""
        result = run(index, q="cabin", lat=37.7749, lon=-122.4194)
        assert [h.title for h in result.hits] == ["Cedar Cabin with Mountain Views"]
        assert 500 < result.hits[0].distance_km < 800

    def test_amenities_and_rather_than_or(self, index):
        assert run(index, amenities=["wifi"]).total == 2
        assert run(index, amenities=["wifi", "hot-tub"]).total == 1
        assert run(index, amenities=["hot-tub", "kitchen"]).total == 0

    def test_facets_can_be_skipped(self, index):
        req = SearchRequest()
        raw = get_es().search(index=index, body=build_query(req, with_facets=False))
        assert to_response(raw.body, req).facets is None
