import SwiftUI

/// A labelled text input with hint and error slots.
///
/// ## The two native details that matter, both invisible on the web
///
/// 1. **`keyboardType` and `textContentType` change the keyboard itself.** An email field should
///    show the "@" key; a ZIP field should show digits. `textContentType` additionally drives
///    AutoFill — without `.password` on a sign-in field, a saved credential is invisible to the
///    customer and they retype it every time.
/// 2. **`autocapitalization` defaults to sentences.** An email field left alone capitalises the
///    first letter and the address is then rejected. It is the single most common mobile form bug,
///    and the reason `.emailField()` below exists as one modifier rather than three call sites that
///    each have to remember all three settings.
struct LabeledTextField: View {
    let title: String
    @Binding var text: String
    var isRequired = false
    var hint: String?
    /// Usually a server-side field error, rendered under the input in red.
    var error: String?
    var isSecure = false

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(isRequired ? "\(title) *" : title)
                .font(.system(size: FontSize.sm, weight: .semibold))
                .foregroundStyle(Theme.colors.textMuted)

            Group {
                if isSecure {
                    SecureField("", text: $text)
                } else {
                    TextField("", text: $text)
                }
            }
            .focused($isFocused)
            .font(.system(size: FontSize.base))
            .foregroundStyle(Theme.colors.text)
            .padding(.horizontal, Spacing.md)
            .frame(height: 46)
            .background(Theme.colors.surface)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sm)
                    .strokeBorder(borderColor, lineWidth: 1.5)
            )
            /*
             * The focus ring is drawn by swapping the border colour, because there is no `:focus`
             * pseudo-class to hook. `@FocusState` is SwiftUI's answer — and unlike the React Native
             * version's onFocus/onBlur pair, it is also writable, so a screen can move focus to the
             * first invalid field after a failed submit.
             */
            .animation(.easeOut(duration: 0.12), value: isFocused)

            if let error {
                Text(error).textStyle(.caption, tone: .danger)
            } else if let hint {
                Text(hint).textStyle(.caption, tone: .subtle)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
        // Errors must be announced, not just coloured — a red border says nothing to VoiceOver.
        .accessibilityValue(error.map { "Error: \($0)" } ?? "")
    }

    private var borderColor: Color {
        if error != nil { return Theme.colors.danger }
        return isFocused ? Theme.colors.primary : Theme.colors.border
    }
}

extension View {
    /// Email fields, configured once.
    ///
    /// Bundling the three settings into one modifier is not just tidiness: they only work together.
    /// A field with `.emailAddress` content type but sentence capitalisation still produces
    /// "Folau@…" and still gets rejected, and that partial configuration is exactly what a
    /// copy-pasted field ends up with.
    func emailField() -> some View {
        keyboardType(.emailAddress)
            .textContentType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
    }

    /// A five-digit ZIP. `.numberPad`, not `.decimalPad` — there is no decimal point in a ZIP code.
    func postalCodeField() -> some View {
        keyboardType(.numberPad)
            .textContentType(.postalCode)
    }
}
