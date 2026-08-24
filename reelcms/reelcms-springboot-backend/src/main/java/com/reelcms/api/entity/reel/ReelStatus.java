package com.reelcms.api.entity.reel;

/** Lifecycle of a reel. Only PUBLISHED is ever visible on the public side. */
public enum ReelStatus {
    DRAFT,
    SCHEDULED,
    PUBLISHED,
    ARCHIVED
}
