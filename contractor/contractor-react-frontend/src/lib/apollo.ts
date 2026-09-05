/**
 * The Apollo client that talks to Hasura.
 *
 * ⚠️ There is no `x-hasura-admin-secret` in this file, and there must never be one. That header
 * grants Hasura's built-in admin role, which bypasses every permission in `hasura/metadata.mjs` —
 * so putting it in a browser bundle hands every visitor unrestricted access to every table.
 * Hasura's own quickstart does exactly that; it is fine in a script and catastrophic here. This
 * client sends the user's JWT instead, and Hasura decides what that JWT may read.
 */

import { ApolloClient, HttpLink, InMemoryCache, from } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'

import { GRAPHQL_URL } from './config'

/**
 * ⚠️ Apollo Client v4 will not accept a default `errorPolicy` until you DECLARE that you set one.
 *
 * The reason is type inference: `useQuery` narrows its result differently under `errorPolicy:
 * "all"` (data can be partial) than under the default `"none"` (data is either there or the hook
 * threw). A default set only at the client would silently invalidate that narrowing everywhere, so
 * v4 requires this module augmentation and otherwise fails with a type whose text IS the error
 * message. It is a compile-time declaration only — the runtime behaviour comes from
 * `defaultOptions` below.
 */
declare module '@apollo/client' {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      interface Query {
        errorPolicy: 'all'
      }
      interface WatchQuery {
        errorPolicy: 'all'
      }
    }
  }
}

const STORAGE_KEY = 'contractor.session'

/**
 * Reads the token straight out of storage rather than from React state.
 *
 * Apollo links live outside the component tree, so they cannot use a hook. Reading storage per
 * request also means a token refresh or a sign-out in another TAB is picked up on the very next
 * query — a token captured once at client construction would go stale and keep sending itself.
 */
function currentToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as { token?: string }).token ?? null
  } catch {
    return null
  }
}

const authLink = new SetContextLink((prevContext) => {
  const token = currentToken()
  return {
    headers: {
      ...prevContext.headers,
      /**
       * ⚠️ No header at all when signed out — NOT `Bearer null`.
       *
       * Hasura falls back to `HASURA_GRAPHQL_UNAUTHORIZED_ROLE` (`anonymous`) only when the
       * Authorization header is ABSENT. Send a malformed one and it tries to verify it, fails, and
       * returns "Malformed Authorization header" instead of the public directory — so the logged-out
       * home page would be broken rather than merely limited.
       */
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
})

const httpLink = new HttpLink({ uri: GRAPHQL_URL })

export const apolloClient = new ApolloClient({
  link: from([authLink, httpLink]),

  cache: new InMemoryCache({
    typePolicies: {
      /**
       * ⚠️ Every type is keyed by `public_id`, because Hasura never exposes the primary key.
       *
       * Apollo's default is to normalise on a field called `id`. None of these rows have one, so
       * without this every object is stored unnormalised under its parent query — two queries that
       * both return the same contractor keep two independent copies, and updating one leaves the
       * other stale on screen.
       */
      users: { keyFields: ['public_id'] },
      service_categories: { keyFields: ['public_id'] },
      contractor_profiles: { keyFields: ['public_id'] },
      portfolio_images: { keyFields: ['public_id'] },
      projects: { keyFields: ['public_id'] },
      quotes: { keyFields: ['public_id'] },
      reviews: { keyFields: ['public_id'] },
      /**
       * ⚠️ `keyFields: false` — do NOT normalise the join table.
       *
       * The obvious-looking choice is `['contractor_profile_id', 'service_category_id']`, since
       * that pair IS the row's identity in Postgres. It breaks at runtime, because the queries do
       * not SELECT those columns — they only ask for the nested `category`. Apollo then cannot
       * build a key and throws:
       *
       *   Missing field 'contractor_profile_id' while extracting keyFields from
       *   { "category": { "__ref": … }, "__typename": "contractor_services" }
       *
       * ...which surfaces as an empty contractor directory, because the error happens during
       * cache normalisation rather than during the fetch. The response was perfectly fine.
       *
       * Selecting the two foreign keys just to satisfy the cache would work and is the wrong fix:
       * a pure link row has no identity worth caching separately from the profile that owns it.
       * `false` stores it inline under its parent, which is what it actually is.
       */
      contractor_services: { keyFields: false },
    },
  }),

  defaultOptions: {
    /**
     * ⚠️ `cache-and-network` on the hook-driven reads, and `network-only` on the imperative ones
     * this app actually uses.
     *
     * Every read in `api/client.ts` goes through `apolloClient.query`, and several of them run
     * immediately after a mutation that changed the rows underneath — accept a quote, then reload
     * the project. Apollo's default `cache-first` would answer that reload from the cache and show
     * the pre-acceptance state, which reads as "the button did nothing".
     *
     * The cache still earns its keep for deduplication within a single render.
     */
    query: { fetchPolicy: 'network-only', errorPolicy: 'all' },
    watchQuery: { fetchPolicy: 'cache-and-network', errorPolicy: 'all' },
  },
})

/**
 * Empties the cache on sign-out.
 *
 * ⚠️ Not optional. Hasura returns different rows for different roles, so a cache left populated
 * across a sign-out can hand the NEXT user rows the previous one was allowed to see — the same
 * class of bug as a shared HTTP cache, and it looks exactly like a permission failure when it is
 * really a client-side one. `resetStore` also refetches active queries, which is why sign-out
 * navigates first.
 */
export async function clearApolloCache(): Promise<void> {
  await apolloClient.clearStore()
}
