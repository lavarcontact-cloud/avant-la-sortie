import CryptoKit
import Foundation

enum FileHasher {
    /// SHA-256 en flux (blocs de 4 Mo) : mémoire constante même pour des vidéos de plusieurs Go.
    static func sha256(of url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var hasher = SHA256()
        while true {
            let block = try autoreleasepool { try handle.read(upToCount: 4 * 1024 * 1024) }
            guard let block, !block.isEmpty else { break }
            hasher.update(data: block)
        }
        return hasher.finalize().hex
    }

    static func sha256(of data: Data) -> String { SHA256.hash(data: data).hex }
}

extension Digest {
    var hex: String { map { String(format: "%02x", $0) }.joined() }
}
