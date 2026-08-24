package com.reelcms.api.entity.reelcollection;

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
 * A curated set of reels - "Buzzer Beaters", "Wonder Goals".
 *
 * <p>The Java type is ReelCollection and the Mongo collection is "reel_collections", both to avoid
 * the word "collection" meaning two different things in the same sentence, and because
 * {@code java.util.Collection} is already imported in half these files.
 *
 * <p>Membership is stored on BOTH sides: reelIds here, collectionIds on the reel. That is a
 * deliberate duplication, because both directions are queried ("what is in this collection" for the
 * public page, "what collections is this reel in" for the editor) and neither should need a scan of
 * the other collection. ReelCollectionServiceImpl is responsible for keeping the two in step - the
 * price of the second index.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "reel_collections")
public class ReelCollection {

    @Id
    private String id;

    private String slug;
    private String name;
    private String description;
    private String coverUrl;

    @Builder.Default
    private List<String> reelIds = new ArrayList<>();

    @CreatedDate
    private Instant createdAt;
}
