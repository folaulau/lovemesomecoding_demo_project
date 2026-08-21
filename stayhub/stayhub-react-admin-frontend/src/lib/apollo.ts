/** Apollo against Hasura, always as the `staff` role.
 *
 * The admin console reads EVERYTHING through Hasura — all listings including drafts and
 * suspended ones, all users, all bookings, and the aggregates behind the dashboard. That is the
 * payoff for having declared staff permissions in metadata: no bespoke read endpoints had to be
 * written for any of it.
 */

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
      // ⚠️ Explicitly requesting `staff`. A staff member's token has it as the DEFAULT role too,
      // so this is belt and braces — but it makes the intent legible, and it fails loudly if a
      // non-staff token ever reaches this app ("Your requested role is not in allowed roles")
      // rather than quietly returning a customer's narrow view of the data.
      //
      // ⚠️ NOT `x-hasura-admin-secret`. That would bypass every permission rule, and it would be
      // sitting in a JavaScript bundle.
      'x-hasura-role': 'staff',
    },
  }
})

const errorLink = new ErrorLink(({ error, operation }) => {
  if (CombinedGraphQLErrors.is(error)) {
    error.errors.forEach((e) => console.error(`[GraphQL] ${operation.operationName}: ${e.message}`))
  } else {
    console.error(`[Network] ${operation.operationName}:`, error)
  }
})

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Properties: { keyFields: ['publicId'] },
      Bookings: { keyFields: ['publicId'] },
      Users: { keyFields: ['publicId'] },
      PropertyImages: { keyFields: false },
    },
  }),
})

export async function clearApollo() {
  try {
    await apolloClient.clearStore()
  } catch {
    /* an active query failing under a changed identity is expected */
  }
}
