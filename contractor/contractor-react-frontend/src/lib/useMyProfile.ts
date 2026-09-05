/**
 * The signed-in contractor's own profile row.
 *
 * Three pro screens need it and each of them needs it before it can load anything else — the lead
 * feed filters by the profile's trades, the quote list filters by its id. Fetching it in one place
 * keeps that dependency explicit instead of repeated.
 *
 * ⚠️ A contractor's user id and their PROFILE id are different values, and confusing them is the
 * easiest mistake in this codebase to make. `quotes.contractor_profile_id` points at the profile;
 * `projects.homeowner_id` points at the user. The naming below is deliberately blunt about it.
 */

import * as api from '../api/client'
import type { ContractorProfile } from '../types/domain'
import { useAuth } from './auth'
import { useAsync } from './useAsync'
import type { AsyncState } from './useAsync'

export function useMyProfile(): AsyncState<ContractorProfile | null> {
  const { user } = useAuth()
  return useAsync(
    () => (user ? api.getContractorByUserId(user.id) : Promise.resolve(null)),
    [user?.id],
  )
}
