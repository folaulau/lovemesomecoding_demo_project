package com.pizza.api.search;

import com.pizza.api.entity.product.Product;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

/**
 * A product as Elasticsearch stores it.
 *
 * <p><b>A separate class from the JPA entity, on purpose.</b> The two model different things: the
 * entity is normalised for correctness and transactions, the document is denormalised for search.
 * Annotating one class with both {@code @Entity} and {@code @Document} is possible and is a trap —
 * the field types you want in a search index (analysed text, keywords) have nothing to do with the
 * column types you want in MySQL, and you end up compromising both.
 *
 * <h2>Text vs Keyword — the single most common Elasticsearch mistake</h2>
 *
 * <ul>
 *   <li>{@link FieldType#Text} is <b>analysed</b>: broken into lowercase tokens, so "Pepperoni
 *       Feast" matches a search for "pepperoni". This is what makes full-text search work.
 *   <li>{@link FieldType#Keyword} is stored whole and matched exactly. Right for filtering,
 *       sorting and aggregating — and useless for free-text search.
 * </ul>
 *
 * <p>Mapping {@code name} as Keyword is why "an exact-match-only search box" happens; mapping
 * {@code type} as Text is why "filter by DRINK" starts returning pizzas.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "products")
public class ProductDocument {

    /** The product's public UUID as a string — the API never exposes the numeric key. */
    @Id
    private String id;

    @Field(type = FieldType.Text)
    private String name;

    @Field(type = FieldType.Text)
    private String description;

    /** Filtered on, never searched as prose. */
    @Field(type = FieldType.Keyword)
    private String type;

    @Field(type = FieldType.Boolean)
    private boolean active;

    @Field(type = FieldType.Double)
    private BigDecimal fromPrice;

    public static ProductDocument from(Product product, BigDecimal fromPrice) {
        return ProductDocument.builder()
                .id(String.valueOf(product.getPublicId()))
                .name(product.getName())
                .description(product.getDescription())
                .type(product.getType().name())
                .active(product.isActive())
                .fromPrice(fromPrice)
                .build();
    }
}
