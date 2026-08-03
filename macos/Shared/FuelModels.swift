import AppIntents
import CoreLocation
import Foundation

let fuelDataBaseURL = URL(string: "https://asv.github.io/cyprus-fuel-map/")!
let fuelMapURL = fuelDataBaseURL
let searchRadiusKilometers = 15.0

struct FuelData: Codable {
    let fuel: String
    let fuelName: String
    let fetchedAt: String
    let minPrice: Double?
    let avgPrice: Double?
    let stations: [FuelStation]
}

struct GlobalFuelHistory: Codable {
    let fuel: String
    let points: [GlobalFuelHistoryPoint]
}

struct GlobalFuelHistoryPoint: Codable {
    let at: String
    let minPrice: Double
}

enum MinimumPriceTrendDirection: Equatable {
    case rising
    case falling
    case unchanged
}

struct MinimumPriceTrend: Equatable {
    let direction: MinimumPriceTrendDirection
    let delta: Double
}

struct FuelStation: Codable, Identifiable, Equatable {
    let id: String
    let brand: String
    let name: String
    let address: String
    let district: String
    let price: Double
    let isOffline: Bool
    let lat: Double?
    let lng: Double?
}

struct StationResult: Identifiable, Equatable {
    let station: FuelStation
    let distanceKilometers: Double

    var id: String { station.id }
}

struct StationSelection: Equatable {
    let nearest: StationResult
    let globalMinimumPrice: Double
    let globalAveragePrice: Double
    let nearbyAveragePrice: Double
    let minimumPriceTrend: MinimumPriceTrend?
}

enum FuelChoice: String, AppEnum, CaseIterable {
    case unleaded95 = "1"
    case unleaded98 = "2"
    case diesel = "3"
    case heatingOil = "4"
    case kerosene = "5"

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Fuel")
    static let caseDisplayRepresentations: [FuelChoice: DisplayRepresentation] = [
        .unleaded95: "Unleaded 95",
        .unleaded98: "Unleaded 98",
        .diesel: "Diesel",
        .heatingOil: "Heating oil",
        .kerosene: "Kerosene",
    ]

    var displayName: String {
        switch self {
        case .unleaded95: "Unleaded 95"
        case .unleaded98: "Unleaded 98"
        case .diesel: "Diesel"
        case .heatingOil: "Heating oil"
        case .kerosene: "Kerosene"
        }
    }
}

enum LocationChoice: String, AppEnum, CaseIterable {
    case automatic
    case famagusta
    case larnaca
    case limassol
    case nicosia
    case paphos

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Location")
    static let caseDisplayRepresentations: [LocationChoice: DisplayRepresentation] = [
        .automatic: "Automatic",
        .famagusta: "Famagusta",
        .larnaca: "Larnaca",
        .limassol: "Limassol",
        .nicosia: "Nicosia",
        .paphos: "Paphos",
    ]

    var displayName: String {
        switch self {
        case .automatic: "Automatic"
        case .famagusta: "Famagusta"
        case .larnaca: "Larnaca"
        case .limassol: "Limassol"
        case .nicosia: "Nicosia"
        case .paphos: "Paphos"
        }
    }

    var coordinate: CLLocationCoordinate2D? {
        switch self {
        case .automatic:
            nil
        case .famagusta:
            CLLocationCoordinate2D(latitude: 35.1174, longitude: 33.9380)
        case .larnaca:
            CLLocationCoordinate2D(latitude: 34.9003, longitude: 33.6232)
        case .limassol:
            CLLocationCoordinate2D(latitude: 34.6786, longitude: 33.0413)
        case .nicosia:
            CLLocationCoordinate2D(latitude: 35.1856, longitude: 33.3823)
        case .paphos:
            CLLocationCoordinate2D(latitude: 34.7754, longitude: 32.4245)
        }
    }
}

struct FuelWidgetConfiguration: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Fuel prices"
    static let description = IntentDescription("Choose a fuel type and location.")

    @Parameter(title: "Fuel", default: .unleaded95)
    var fuel: FuelChoice

    @Parameter(title: "Location", default: .automatic)
    var location: LocationChoice

    init() {}

    init(fuel: FuelChoice, location: LocationChoice) {
        self.fuel = fuel
        self.location = location
    }
}

func selectStations(
    from stations: [FuelStation],
    around coordinate: CLLocationCoordinate2D,
    globalMinimumPrice: Double?,
    globalAveragePrice: Double?,
    globalHistory: GlobalFuelHistory? = nil,
    currentAt: Date? = nil
) -> StationSelection? {
    let origin = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
    let candidates = stations.compactMap { station -> StationResult? in
        guard !station.isOffline, let latitude = station.lat, let longitude = station.lng else { return nil }
        let stationLocation = CLLocation(latitude: latitude, longitude: longitude)
        let distance = origin.distance(from: stationLocation) / 1_000
        guard distance <= searchRadiusKilometers else { return nil }
        return StationResult(station: station, distanceKilometers: distance)
    }

    guard let nearest = candidates.min(by: { $0.distanceKilometers < $1.distanceKilometers }) else { return nil }
    let nearbyPrices = candidates.map(\.station.price)
    let cyprusPrices = stations.filter { !$0.isOffline }.map(\.price)
    let fallbackMinimum = cyprusPrices.min()
    let fallbackAverage = cyprusPrices.isEmpty ? nil : cyprusPrices.reduce(0, +) / Double(cyprusPrices.count)
    guard let cyprusMinimum = globalMinimumPrice ?? fallbackMinimum else { return nil }
    guard let cyprusAverage = globalAveragePrice ?? fallbackAverage else { return nil }
    return StationSelection(
        nearest: nearest,
        globalMinimumPrice: cyprusMinimum,
        globalAveragePrice: cyprusAverage,
        nearbyAveragePrice: nearbyPrices.reduce(0, +) / Double(nearbyPrices.count),
        minimumPriceTrend: globalHistory.flatMap {
            minimumPriceTrend(from: $0, currentMinimumPrice: cyprusMinimum, currentAt: currentAt)
        }
    )
}

func minimumPriceTrend(
    from history: GlobalFuelHistory,
    currentMinimumPrice: Double,
    currentAt: Date?
) -> MinimumPriceTrend? {
    let comparisonDate = (currentAt ?? .now).addingTimeInterval(-24 * 60 * 60)
    let baseline = history.points
        .compactMap { point -> (date: Date, price: Double)? in
            guard let date = parsedFuelDate(point.at), date <= comparisonDate else { return nil }
            return (date, point.minPrice)
        }
        .max(by: { $0.date < $1.date })
    guard let baseline else { return nil }

    let delta = currentMinimumPrice - baseline.price
    let direction: MinimumPriceTrendDirection
    if delta >= 0.0005 {
        direction = .rising
    } else if delta <= -0.0005 {
        direction = .falling
    } else {
        direction = .unchanged
    }
    return MinimumPriceTrend(direction: direction, delta: delta)
}

func parsedFuelDate(_ value: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
}
