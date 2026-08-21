"""Measure `/admin/stats` (sync, eight serial queries) against `/admin/stats-async` (concurrent).

    .venv/bin/python -m scripts.bench_stats

Exists so the async-vs-sync post quotes a number taken on a real machine rather than a claim.
Run it yourself before believing it — on a fast local Postgres the gap is small, because the win
is round-trip latency and there is barely any. On a database across a network it grows, which is
the actual lesson: async pays in proportion to how long you WAIT.
"""

import argparse
import statistics
import time

import httpx

BASE = "http://localhost:8000"


def login(client: httpx.Client, email: str, password: str) -> str:
    r = client.post(f"{BASE}/api/v1/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["accessToken"]


def time_endpoint(client: httpx.Client, path: str, token: str, runs: int) -> list[float]:
    headers = {"Authorization": f"Bearer {token}"}
    samples = []
    for _ in range(runs):
        started = time.perf_counter()
        r = client.get(f"{BASE}{path}", headers=headers)
        r.raise_for_status()
        samples.append((time.perf_counter() - started) * 1000)
    return samples


def report(name: str, samples: list[float]) -> float:
    median = statistics.median(samples)
    print(
        f"  {name:<22} median {median:7.1f}ms   "
        f"min {min(samples):6.1f}   max {max(samples):6.1f}"
    )
    return median


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=30)
    parser.add_argument("--email", default="admin@stayhub.test")
    parser.add_argument("--password", default="admin123")
    args = parser.parse_args()

    with httpx.Client(timeout=30) as client:
        token = login(client, args.email, args.password)

        # Warm up both: first call pays for pool creation and query planning, and including that
        # in the median measures startup rather than steady state.
        time_endpoint(client, "/api/v1/admin/stats", token, 3)
        time_endpoint(client, "/api/v1/admin/stats-async", token, 3)

        sync_samples = time_endpoint(client, "/api/v1/admin/stats", token, args.runs)
        async_samples = time_endpoint(client, "/api/v1/admin/stats-async", token, args.runs)

    print(f"\n{args.runs} runs each, after warm-up:\n")
    sync_median = report("sync (8 serial)", sync_samples)
    async_median = report("async (8 concurrent)", async_samples)

    delta = (sync_median - async_median) / sync_median * 100
    print(f"\n  async is {delta:+.1f}% vs sync (positive = async faster)\n")

    # Correctness matters more than speed: a faster endpoint returning different numbers is not a
    # win. This is the assertion the benchmark exists to protect.
    with httpx.Client(timeout=30) as client:
        token = login(client, args.email, args.password)
        headers = {"Authorization": f"Bearer {token}"}
        a = client.get(f"{BASE}/api/v1/admin/stats", headers=headers).json()
        b = client.get(f"{BASE}/api/v1/admin/stats-async", headers=headers).json()

    if a == b:
        print("  both endpoints return identical numbers ✓")
        return 0
    print(f"  ⚠️ MISMATCH\n    sync : {a}\n    async: {b}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
