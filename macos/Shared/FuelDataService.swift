import Foundation

struct FuelDataService {
    enum ServiceError: LocalizedError {
        case invalidResponse

        var errorDescription: String? {
            "GitHub Pages returned an invalid response."
        }
    }

    private let session: URLSession
    private let cacheDirectory: URL

    init(session: URLSession = .shared) {
        self.session = session
        cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("FuelData", isDirectory: true)
    }

    func load(fuel: FuelChoice) async throws -> FuelData {
        let cacheURL = cacheURL(filename: "stations-\(fuel.rawValue).json")
        do {
            let data = try await download(path: "data/stations-\(fuel.rawValue).json")
            try? save(data, to: cacheURL)
            return try decode(data)
        } catch {
            guard let cached = try? Data(contentsOf: cacheURL) else { throw error }
            return try decode(cached)
        }
    }

    func loadHistory(fuel: FuelChoice) async throws -> GlobalFuelHistory {
        let cacheURL = cacheURL(filename: "global-\(fuel.rawValue).json")
        do {
            let data = try await download(path: "data/history/global-\(fuel.rawValue).json")
            try? save(data, to: cacheURL)
            return try decode(data)
        } catch {
            guard let cached = try? Data(contentsOf: cacheURL) else { throw error }
            return try decode(cached)
        }
    }

    private func download(path: String) async throws -> Data {
        let url = fuelDataBaseURL.appendingPathComponent(path)
        var request = URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData, timeoutInterval: 20)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
            throw ServiceError.invalidResponse
        }
        return data
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        try JSONDecoder().decode(T.self, from: data)
    }

    private func save(_ data: Data, to url: URL) throws {
        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }

    private func cacheURL(filename: String) -> URL {
        cacheDirectory.appendingPathComponent(filename)
    }
}
