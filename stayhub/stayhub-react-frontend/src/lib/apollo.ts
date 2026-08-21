/** Apollo Client, pointed at Hasura. This is the READ side of the app.
 *
 * The interesting part is the auth link: it puts the SAME JWT that FastAPI issued onto every
 * GraphQL request. Hasura verifies the signature itself with the shared secret, reads the
 * `x-hasura-*` claims, and applies row-level permissions from them. No second login, no auth
 * webhook, no session store.
 */

// ⚠️ Apollo Client v4 split its entry points. The React bindings (`useQuery`,
// `ApolloProvider`) moved to `@apollo/client/react`, and `ErrorLink` replaced the deprecated
// `onError`. Every v3 tutorial imports them all from '@apollo/client' and fails with
// "has no exported member 'useQuery'" — which reads like a broken install.
import { ApolloClient, CombinedGraphQLErrors, HttpLink, InMemoryCache, from } from '@apollo/client'
import { SetContextLink } from '@apollo/client/link/context'
import { ErrorLink } from '@apollo/client/link/error'
import { tokenStore } from './api'

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_HASURA_URL ?? 'http://localhost:8081/v1/graphql',
})

const authLink = new SetContextLink(({ headers }) => {
  const token = tokenStore.get()
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }
  // ⚠️ Note what is NOT here: `x-hasura-admin-secret`. It appears in Hasura's own quickstart and
  // in most blog posts, and putting it in a browser hands every visitor the unrestricted admin
  // role. The token is the only credential a frontend should ever send.
  //
  // ⚠️ Also absent: an explicit `x-hasura-role`. Omitting it makes Hasura use the token's
  // `x-hasura-default-role`, which is what you want almost always. Send it only to act as a
  // NON-default role you are allowed — e.g. a host deliberately querying as `host`.
})

const errorLink = new ErrorLink(({ error, operation }) => {
  // Hasura reports a permission failure as a GraphQL error with a 200 HTTP status, so a `fetch`
  // that "succeeded" can still have returned nothing. Logging the operation name is what turns
  // "field 'bookings' not found in type 'query_root'" into an actionable clue: it almost always
  // means the current role has no select permission on that table.
  //
  // v4 hands over ONE `error`; the GraphQL-vs-network split is now a type check rather than two
  // separate callback arguments.
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach((err) => {
      console.error(`[GraphQL] ${operation.operationName}: ${err.message}`)
    })
  } else {
    console.error(`[Network] ${operation.operationName}:`, error)
  }
})

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      // ⚠️ Hasura's types have no `id` field — StayHub exposes `publicId` instead — so Apollo
      // cannot normalise them by default and every query gets its own cache entry. Naming the
      // key fields is what lets two queries returning the same listing share one cached object.
      Properties: { keyFields: ['publicId'] },
      Bookings: { keyFields: ['publicId'] },
      Users: { keyFields: ['publicId'] },
      Amenities: { keyFields: ['slug'] },
      // Property images have no unique field of their own; they are only ever read as part of a
      // parent listing, so `false` tells Apollo to embed them rather than normalise them.
      PropertyImages: { keyFields: false },
      PropertyAmenities: { keyFields: false },
    },
  }),
  defaultOptions: {
    watchQuery: {
      // Serve the cache immediately, then refetch. On a listing you have already seen this is the
      // difference between an instant render and a spinner.
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
    },
  },
})

/** Called on sign-in and sign-out.
 *
 * ⚠️ The cache MUST be cleared when identity changes. Apollo has no idea the token changed, so
 * without this a user who signs out keeps seeing the previous user's bookings served straight
 * from cache — with no network request to notice.
 *
 * `resetStore()` refetches active queries as the new identity; `clearStore()` just empties. Reset
 * on sign-in (the page should repopulate), clear on sign-out (there may be nothing to fetch).
 */
export async function resetApolloAfterAuthChange(signedIn: boolean): Promise<void> {
  try {
    if (signedIn) await apolloClient.resetStore()
    else await apolloClient.clearStore()
  } catch {
    // resetStore rejects if an active query then fails under the new identity — e.g. a bookings
    // query that is legitimately no longer permitted. That is expected, not an error worth
    // surfacing to the user.
  }
}
