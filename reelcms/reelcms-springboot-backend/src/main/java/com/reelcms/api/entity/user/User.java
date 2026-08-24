package com.reelcms.api.entity.user;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * A sign-in account.
 *
 * <p>Kept separate from Creator on purpose: an ADMIN is a person who administers the site and is
 * not a creator at all, while a creator profile is public content that outlives whoever logs in to
 * manage it. Collapsing the two is a common early shortcut that gets expensive the first time you
 * need two people managing one channel.
 *
 * <p>creatorId links a CREATOR account to the profile it may edit. Null for admins.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {

    @Id
    private String id;

    /** Unique index. The login identifier. */
    private String email;

    /** BCrypt hash. Never serialized - see UserDto, which has no field for it. */
    private String passwordHash;

    private String displayName;

    @Builder.Default
    private List<String> roles = new ArrayList<>();

    /** The Creator this account may publish as. Null for ADMIN. */
    private String creatorId;

    @CreatedDate
    private Instant createdAt;
}
