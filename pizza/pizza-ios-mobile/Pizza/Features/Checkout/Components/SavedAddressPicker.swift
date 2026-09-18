import SwiftUI

/// A radio list of the customer's saved addresses, plus a "different address" option.
///
/// Guests never see this — they have no account, so there is nothing to load.
///
/// ## The accessibility work a drawn radio needs
///
/// SwiftUI has no radio control, so the circle and its dot are drawn. Drawn controls carry no
/// semantics at all: without the traits below, VoiceOver reads a list of unrelated buttons and
/// never says which one is chosen. `.isToggle` plus `.isSelected` is what turns it back into
/// "Home, selected" — and it is the reason the option is a `Button` rather than a tappable `HStack`,
/// since only a real button carries the tap semantics to begin with.
@MainActor
struct SavedAddressPicker: View {
    let addresses: [Address]
    @Binding var selectedID: UUIDString
    let newAddressID: UUIDString

    var body: some View {
        if addresses.isEmpty {
            EmptyView()
        } else {
            VStack(spacing: Spacing.sm) {
                ForEach(addresses) { address in
                    option(
                        isSelected: selectedID == address.id,
                        title: address.label?.isEmpty == false ? address.label! : "Address",
                        subtitle: address.singleLine,
                        isPrimary: address.primary
                    ) {
                        selectedID = address.id
                    }
                }

                option(
                    isSelected: selectedID == newAddressID,
                    title: "Use a different address",
                    subtitle: nil,
                    isPrimary: false
                ) {
                    selectedID = newAddressID
                }
            }
        }
    }

    private func option(
        isSelected: Bool,
        title: String,
        subtitle: String?,
        isPrimary: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: Spacing.md) {
                radio(isSelected: isSelected)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: Spacing.sm) {
                        Text(title).textStyle(.bodyStrong)
                        if isPrimary { StatusBadge(label: "primary", tone: .success) }
                    }
                    if let subtitle {
                        Text(subtitle)
                            .textStyle(.caption, tone: .muted)
                            .multilineTextAlignment(.leading)
                    }
                }

                Spacer(minLength: 0)
            }
            .padding(Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .fill(isSelected ? Theme.colors.primarySoft : .clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(
                        isSelected ? Theme.colors.primary : Theme.colors.borderSubtle,
                        lineWidth: 1.5
                    )
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(.isToggle)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
        .accessibilityLabel(subtitle.map { "\(title). \($0)" } ?? title)
    }

    private func radio(isSelected: Bool) -> some View {
        ZStack {
            Circle()
                .strokeBorder(
                    isSelected ? Theme.colors.primary : Theme.colors.border,
                    lineWidth: 2
                )
                .frame(width: 20, height: 20)

            if isSelected {
                Circle().fill(Theme.colors.primary).frame(width: 10, height: 10)
            }
        }
        .padding(.top, 2)
        .accessibilityHidden(true)
    }
}

#if DEBUG
/// A preview needs somewhere for `@State` to live.
///
/// `#Preview` is not a `View`, so it cannot declare state of its own on this toolchain — a wrapper
/// view is the portable way to give a `@Binding`-based component something real to bind to, and it
/// also exercises the component the way a screen actually uses it.
@MainActor
private struct SavedAddressPickerPreview: View {
    @State private var selectedID = SampleData.address.id

    var body: some View {
        SavedAddressPicker(
            addresses: [SampleData.address],
            selectedID: $selectedID,
            newAddressID: CheckoutViewModel.newAddressID
        )
        .padding()
        .background(Theme.colors.background)
    }
}

#Preview {
    SavedAddressPickerPreview()
}
#endif
