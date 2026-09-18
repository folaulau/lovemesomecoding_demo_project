import SwiftUI

/// Lays subviews out left to right, wrapping onto a new line when the width runs out.
///
/// ## Why this has to be written by hand
///
/// It is `flex-wrap: wrap` on the web and `flexWrap: 'wrap'` in React Native, and SwiftUI ships no
/// equivalent: `HStack` never wraps, and `LazyVGrid` needs columns of a known width, which is wrong
/// for chips whose width is their text. This is one of the few places where SwiftUI asks for more
/// code than the other two frameworks rather than less.
///
/// ## What `Layout` is
///
/// A protocol (iOS 16+) for participating in SwiftUI's layout pass directly, with two required
/// methods:
///
/// - `sizeThatFits` — "given this much room, how big are you?"
/// - `placeSubviews` — "here is your final frame; position your children."
///
/// Both are called with a `ProposedViewSize` whose dimensions are **optional**. `nil` means "I am
/// not proposing anything, tell me what you want" — which is what a `ScrollView` does along its
/// scroll axis. Treating `nil` as zero is the classic mistake and it collapses the layout to
/// nothing; `replacingUnspecifiedDimensions` is the correct handling and the reason it appears
/// below.
struct FlowLayout: Layout {
    var spacing: CGFloat = Spacing.sm
    var lineSpacing: CGFloat = Spacing.sm

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.replacingUnspecifiedDimensions().width
        let rows = layout(subviews: subviews, maxWidth: maxWidth)

        let height = rows.reduce(0) { $0 + $1.height } + lineSpacing * CGFloat(max(rows.count - 1, 0))
        let width = rows.map(\.width).max() ?? 0

        return CGSize(width: max(width, 0), height: max(height, 0))
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal _: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        let rows = layout(subviews: subviews, maxWidth: bounds.width)
        var y = bounds.minY

        for row in rows {
            var x = bounds.minX
            for index in row.indices {
                let size = subviews[index].sizeThatFits(.unspecified)
                subviews[index].place(
                    at: CGPoint(x: x, y: y),
                    // `.topLeading`, so a taller chip in the row does not push its shorter
                    // neighbours off their shared baseline.
                    anchor: .topLeading,
                    proposal: ProposedViewSize(size)
                )
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    // MARK: - Line breaking

    private struct Row {
        var indices: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    /// Greedy line breaking: keep adding to the current row until the next item does not fit.
    ///
    /// Shared by both protocol methods so the measurement and the placement cannot disagree —
    /// computing the rows twice with slightly different code is how a layout ends up reporting one
    /// height and drawing another.
    private func layout(subviews: Subviews, maxWidth: CGFloat) -> [Row] {
        var rows: [Row] = []
        var current = Row()

        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let widthIfAdded = current.indices.isEmpty ? size.width : current.width + spacing + size.width

            // The `!current.indices.isEmpty` guard prevents an infinite line break: an item wider
            // than the container must still be placed somewhere rather than wrapping forever.
            if widthIfAdded > maxWidth, !current.indices.isEmpty {
                rows.append(current)
                current = Row(indices: [index], width: size.width, height: size.height)
            } else {
                current.indices.append(index)
                current.width = widthIfAdded
                current.height = max(current.height, size.height)
            }
        }

        if !current.indices.isEmpty { rows.append(current) }
        return rows
    }
}
