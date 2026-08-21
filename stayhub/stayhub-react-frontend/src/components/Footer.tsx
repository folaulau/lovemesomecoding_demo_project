export function Footer() {
  return (
    <footer className="mt-20 border-t border-ink-200 bg-ink-50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <h4 className="text-sm font-semibold text-ink-900">StayHub</h4>
            <p className="mt-2 max-w-xs text-sm text-ink-600">
              A demo short-term rental app built for lovemesomecoding.com — FastAPI, Hasura,
              Postgres and Elasticsearch.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink-900">How it is built</h4>
            <ul className="mt-2 space-y-1 text-sm text-ink-600">
              <li>Writes → FastAPI</li>
              <li>Reads → Hasura GraphQL</li>
              <li>Search → Elasticsearch</li>
              <li>One JWT, verified by both</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-ink-900">Demo logins</h4>
            {/*
              ⚠️ Acceptable ONLY because these are throwaway local fixtures against a seeded
              database. The moment this points at anything real, this block is the first thing
              to delete.
            */}
            <ul className="mt-2 space-y-1 font-mono text-xs text-ink-600">
              <li>guest@stayhub.test / guest123</li>
              <li>host@stayhub.test / host123</li>
              <li>admin@stayhub.test / admin123</li>
            </ul>
          </div>
        </div>
        <p className="mt-8 border-t border-ink-200 pt-6 text-xs text-ink-500">
          Not affiliated with Airbnb. Listing photos from Unsplash.
        </p>
      </div>
    </footer>
  )
}
