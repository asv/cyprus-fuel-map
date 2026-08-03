import CoreLocation
import SwiftUI
import WidgetKit

@main
struct CyprusFuelApp: App {
    var body: some Scene {
        WindowGroup {
            DiagnosticsView()
                .frame(minWidth: 460, minHeight: 360)
        }
        .windowResizability(.contentSize)
    }
}

struct DiagnosticsView: View {
    @StateObject private var location = LocationAuthorizationModel()
    @StateObject private var diagnostics = DataDiagnosticsModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Cyprus Fuel")
                    .font(.largeTitle.bold())
                Text("Setup and diagnostics for the desktop widget.")
                    .foregroundStyle(.secondary)
            }

            GroupBox("Location") {
                HStack {
                    Image(systemName: location.symbolName)
                        .font(.title2)
                        .foregroundStyle(location.isAuthorized ? .green : .orange)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(location.statusText)
                            .font(.headline)
                        Text(location.detailText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Allow Location") {
                        location.requestAuthorization()
                    }
                    .disabled(location.isAuthorized)
                }
                .padding(8)
            }

            GroupBox("GitHub Pages data") {
                HStack {
                    Image(systemName: diagnostics.symbolName)
                        .font(.title2)
                        .foregroundStyle(diagnostics.isAvailable ? .green : .secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(diagnostics.statusText)
                            .font(.headline)
                        Text(diagnostics.detailText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button("Check Now") {
                        Task { await diagnostics.refresh() }
                    }
                    .disabled(diagnostics.isLoading)
                }
                .padding(8)
            }

            Text("After allowing location, add Cyprus Fuel Prices from the macOS widget gallery. You can also select a city in the widget settings.")
                .font(.callout)
                .foregroundStyle(.secondary)

            HStack {
                Link("Open fuel map", destination: fuelMapURL)
                Spacer()
                Text("The widget refreshes automatically.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(24)
        .task {
            await diagnostics.refresh()
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}

@MainActor
final class LocationAuthorizationModel: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    @Published private(set) var status: CLAuthorizationStatus = .notDetermined
    @Published private(set) var lastLocation: CLLocation?

    private let manager = CLLocationManager()

    override init() {
        super.init()
        status = manager.authorizationStatus
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
        if isAuthorized {
            manager.requestLocation()
        }
    }

    var isAuthorized: Bool {
        status == .authorizedAlways
    }

    var symbolName: String {
        isAuthorized ? "location.fill" : "location.slash"
    }

    var statusText: String {
        switch status {
        case .notDetermined:
            "Permission not requested"
        case .restricted:
            "Location is restricted"
        case .denied:
            "Location access denied"
        case .authorizedAlways:
            "Location access allowed"
        @unknown default:
            "Unknown location status"
        }
    }

    var detailText: String {
        if let lastLocation {
            return "Current accuracy: ±\(Int(lastLocation.horizontalAccuracy.rounded())) m"
        }
        if status == .denied {
            return "Enable Cyprus Fuel under System Settings → Privacy & Security → Location Services."
        }
        return "Used to find stations within 15 km."
    }

    func requestAuthorization() {
        if status == .denied {
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices") {
                NSWorkspace.shared.open(url)
            }
            return
        }
        manager.requestAlwaysAuthorization()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        status = manager.authorizationStatus
        if isAuthorized {
            manager.requestLocation()
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        lastLocation = locations.last
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // Authorization is the actionable diagnostic; transient positioning failures need no alert here.
    }
}

@MainActor
final class DataDiagnosticsModel: ObservableObject {
    private struct Manifest: Decodable {
        let generatedAt: String
        let fuels: [Fuel]
    }

    private struct Fuel: Decodable {
        let fuel: String
    }

    @Published private(set) var isLoading = false
    @Published private(set) var isAvailable = false
    @Published private(set) var statusText = "Not checked"
    @Published private(set) var detailText = "Checks the public snapshot used by the widget."

    var symbolName: String {
        isAvailable ? "checkmark.icloud.fill" : "icloud"
    }

    func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let url = fuelDataBaseURL.appendingPathComponent("data/manifest.json")
            let (data, response) = try await URLSession.shared.data(from: url)
            guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let manifest = try JSONDecoder().decode(Manifest.self, from: data)
            isAvailable = true
            statusText = "Data available"
            let date = parsedFuelDate(manifest.generatedAt)
            let updated = date?.formatted(date: .abbreviated, time: .shortened) ?? manifest.generatedAt
            detailText = "\(manifest.fuels.count) fuel types · updated \(updated)"
        } catch {
            isAvailable = false
            statusText = "Data unavailable"
            detailText = error.localizedDescription
        }
    }
}
