import SwiftUI

/// Pick a size, a crust and toppings, and watch the price update live.
@MainActor
struct PizzaBuilderSheet: View {
    @Environment(CartStore.self) private var cart
    @Environment(ToastCenter.self) private var toasts
    @Environment(MenuStore.self) private var menu

    private let product: Product
    private let onClose: () -> Void

    /// `@State` holding a reference type, initialised once.
    ///
    /// `@State` is normally for value types, but it is also what gives a reference type a lifetime
    /// tied to the view's identity: the model is constructed the first time this view appears and
    /// kept across every redraw. A plain `let` would rebuild it — and reset every selection — on
    /// each redraw, which for a sheet that redraws on every topping tap means it would never make
    /// it past the first one.
    @State private var model: PizzaBuilderViewModel

    init(product: Product, onClose: @escaping () -> Void) {
        self.product = product
        self.onClose = onClose
        // The catalogue is passed in from the sheet's presenter via the initialiser rather than
        // read from the environment, because `@Environment` is not available at init time.
        _model = State(initialValue: PizzaBuilderViewModel(product: product, catalogue: .init()))
    }

    var body: some View {
        SheetScaffold(title: product.name, onClose: onClose) {
            VStack(alignment: .leading, spacing: Spacing.xl) {
                if !product.description.isEmpty {
                    Text(product.description).textStyle(.caption, tone: .muted)
                }

                section("Size") {
                    SegmentedPicker(segments: model.sizeSegments, selection: $model.selectedSize)
                }

                // Crust and toppings only make sense for a pizza.
                if model.isPizza {
                    section("Crust") { crustChips }
                    toppingsSection
                }

                section("Quantity") {
                    QuantityStepper(
                        quantity: $model.quantity,
                        itemName: product.name,
                        range: 1 ... 10
                    )
                }
            }
            .padding(.top, Spacing.xs)
        } footer: {
            footer
        }
        .onAppear {
            /*
             * The model is rebuilt here with the real catalogue.
             *
             * `init` cannot read `@Environment` — the property wrappers are not populated until the
             * view is installed in the hierarchy — so the initial model is constructed with an
             * empty catalogue and replaced on appear. The alternative is passing the catalogue
             * down through `MenuView`, which works but couples the two screens for no gain.
             */
            model = PizzaBuilderViewModel(product: product, catalogue: menu.catalogue)
        }
    }

    private var crustChips: some View {
        FlowLayout(spacing: Spacing.sm) {
            ForEach(model.crusts) { crust in
                ToppingChip(
                    label: crust.name,
                    detail: crust.priceDelta > 0 ? "+\(Money.format(crust.priceDelta))" : nil,
                    isSelected: model.selectedCrustID == crust.id
                ) {
                    model.selectedCrustID = crust.id
                }
            }
        }
    }

    private var toppingsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Text("Toppings").textStyle(.label, tone: .muted)
                if !model.selectedToppings.isEmpty {
                    StatusBadge(label: "\(model.selectedToppings.count) selected", tone: .primary)
                }
            }

            ForEach(model.toppingGroups, id: \.category) { group in
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(group.title)
                        .font(.system(size: FontSize.sm, weight: .semibold))
                        .foregroundStyle(Theme.colors.textMuted)

                    FlowLayout(spacing: Spacing.sm) {
                        ForEach(group.toppings) { topping in
                            ToppingChip(
                                label: topping.name,
                                detail: "+\(Money.format(topping.price))",
                                isSelected: model.isSelected(topping)
                            ) {
                                model.toggle(topping)
                            }
                        }
                    }
                }
                .padding(.bottom, Spacing.sm)
            }
        }
    }

    private var footer: some View {
        HStack {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(Money.format(model.unitPrice)) each").textStyle(.caption, tone: .muted)
                Text(Money.format(model.totalPrice))
                    .textStyle(.heading)
                    .monospacedDigit()
                    // Animates the digits rather than cross-fading the whole label, so the price
                    // reads as counting up when a topping is added.
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: 0.2), value: model.totalPrice)
            }

            Spacer()

            Button("Add to cart") {
                toasts.show(model.addToCart(using: cart))
                onClose()
            }
            .buttonStyle(.pizzaPrimary)
        }
        .padding(.bottom, Spacing.sm)
    }

    private func section(
        _ title: String,
        @ViewBuilder content: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(title).textStyle(.label, tone: .muted)
            content()
        }
    }
}

#if DEBUG
#Preview {
    let environment = AppEnvironment.preview()
    return Color.clear.sheet(isPresented: .constant(true)) {
        PizzaBuilderSheet(product: SampleData.pepperoni) {}
            .environment(environment.cart)
            .environment(environment.toasts)
            .environment(environment.menu)
    }
}
#endif
