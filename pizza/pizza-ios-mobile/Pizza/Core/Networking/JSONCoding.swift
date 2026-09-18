import Foundation

/// The app's single encoder and decoder.
///
/// Both are created once and shared. `JSONDecoder()` is cheap but not free, and — more importantly
/// — a decoder constructed at each call site is a decoder whose *configuration* can drift. The day
/// a date strategy is needed, it needs to be needed in exactly one place.
///
/// No `keyDecodingStrategy` is set on purpose. The API already speaks lowerCamelCase, so
/// `.convertFromSnakeCase` would be a no-op that quietly mangles any field that ever arrives with
/// an underscore in it. Where a Swift property name must differ from the wire name, the model
/// declares an explicit `CodingKeys` — visible at the model, rather than implied globally here.
enum JSONCoding {
    static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        return encoder
    }()

    static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()
}

/// The stand-in for a response with no body.
///
/// `204 No Content` has nothing to decode, and `JSONDecoder` throws on empty input rather than
/// returning "nothing". Callers that expect no body ask for `EmptyResponse`, and the client below
/// short-circuits it. Without this, every `delete` would need its own non-generic overload.
struct EmptyResponse: Decodable, Equatable {}
