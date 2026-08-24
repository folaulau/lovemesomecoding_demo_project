package com.reelcms.api.security;

import java.util.List;

/**
 * Who is making this request.
 *
 * <p>Held as the Authentication principal, so any controller or service can reach it via
 * SecurityContextHolder without another database round trip - everything needed for an
 * authorization decision is already in the token.
 */
public record AuthPrincipal(String userId, String email, List<String> roles, String creatorId) {

    public boolean isAdmin() {
        return roles.contains("ADMIN");
    }

    /** A creator may only touch reels whose creator.id is their own profile. */
    public boolean ownsCreator(String otherCreatorId) {
        return creatorId != null && creatorId.equals(otherCreatorId);
    }
}
