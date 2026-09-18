import Foundation
import Observation

/// Add or edit one address.
///
/// The same model does both, keyed off whether an `address` was passed in. Two nearly-identical
/// types would drift the moment a field is added to one and not the other.
@MainActor
@Observable
final class AddressFormViewModel {
    var form: AddressWriteRequest
    private(set) var isSaving = false
    private(set) var errorMessage: String?
    private(set) var fieldErrors: [String: String] = [:]

    private let existingAddress: Address?
    private let repository: ProfileRepository

    init(address: Address?, repository: ProfileRepository) {
        self.existingAddress = address
        self.repository = repository
        // Seeded from the address once, in the initialiser. Because the sheet is created fresh for
        // each presentation, there is no "copy the props into state when it reopens" problem to
        // solve — see the comment on `.sheet(item:)` in `ProfileView`.
        self.form = AddressWriteRequest(from: address)
    }

    var isEditing: Bool { existingAddress != nil }
    var title: String { isEditing ? "Edit address" : "Add an address" }
    var saveTitle: String { isEditing ? "Save changes" : "Add address" }

    /// Saves, and returns the message to show — or nil if it failed and the sheet should stay open.
    func save() async -> String? {
        isSaving = true
        errorMessage = nil
        fieldErrors = [:]
        defer { isSaving = false }

        do {
            if let existingAddress {
                _ = try await repository.updateAddress(id: existingAddress.id, with: form)
                return "Address updated"
            }
            _ = try await repository.addAddress(form)
            return "Address added"
        } catch {
            guard !ErrorPresenter.isCancellation(error) else { return nil }
            errorMessage = ErrorPresenter.message(for: error, fallback: "Could not save the address.")
            // The API returns per-field messages; showing them under the right input beats one
            // banner that says "something in this form is wrong, find it".
            if let apiError = error as? APIError { fieldErrors = apiError.fieldErrors }
            return nil
        }
    }
}
