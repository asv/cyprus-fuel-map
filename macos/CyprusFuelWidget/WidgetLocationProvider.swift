import CoreLocation
import Foundation

enum WidgetLocationError: LocalizedError {
    case unavailable
    case notAuthorized

    var errorDescription: String? {
        switch self {
        case .unavailable:
            "Current location is unavailable."
        case .notAuthorized:
            "Open Cyprus Fuel and allow location access."
        }
    }
}

@MainActor
final class WidgetLocationProvider: NSObject, @preconcurrency CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    static func currentCoordinate() async throws -> CLLocationCoordinate2D {
        let provider = WidgetLocationProvider()
        return try await provider.requestCoordinate()
    }

    private func requestCoordinate() async throws -> CLLocationCoordinate2D {
        guard CLLocationManager.locationServicesEnabled() else {
            throw WidgetLocationError.unavailable
        }
        guard manager.authorizationStatus == .authorizedAlways,
              manager.isAuthorizedForWidgetUpdates
        else {
            throw WidgetLocationError.notAuthorized
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else {
            finish(with: .failure(WidgetLocationError.unavailable))
            return
        }
        finish(with: .success(location.coordinate))
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        finish(with: .failure(error))
    }

    private func finish(with result: Result<CLLocationCoordinate2D, Error>) {
        guard let continuation else { return }
        self.continuation = nil
        continuation.resume(with: result)
    }
}
