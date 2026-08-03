import CoreLocation
import SwiftUI
import WidgetKit

struct FuelWidgetEntry: TimelineEntry {
    enum Content {
        case loaded(StationSelection)
        case message(String)
    }

    let date: Date
    let fuel: FuelChoice
    let location: LocationChoice
    let fetchedAt: Date?
    let content: Content
}

struct FuelWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> FuelWidgetEntry {
        let nearest = StationResult(station: previewStation(name: "Nearest station", price: 1.429), distanceKilometers: 1.2)
        return FuelWidgetEntry(
            date: .now,
            fuel: .unleaded95,
            location: .automatic,
            fetchedAt: .now,
            content: .loaded(
                StationSelection(
                    nearest: nearest,
                    globalMinimumPrice: 1.389,
                    globalAveragePrice: 1.472,
                    nearbyAveragePrice: 1.455,
                    minimumPriceTrend: MinimumPriceTrend(direction: .rising, delta: 0.004)
                )
            )
        )
    }

    func snapshot(for configuration: FuelWidgetConfiguration, in context: Context) async -> FuelWidgetEntry {
        if context.isPreview { return placeholder(in: context) }
        return await makeEntry(configuration: configuration)
    }

    func timeline(for configuration: FuelWidgetConfiguration, in context: Context) async -> Timeline<FuelWidgetEntry> {
        let entry = await makeEntry(configuration: configuration)
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: .now) ?? .now.addingTimeInterval(3_600)
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }

    private func makeEntry(configuration: FuelWidgetConfiguration) async -> FuelWidgetEntry {
        do {
            let coordinate: CLLocationCoordinate2D
            if let cityCoordinate = configuration.location.coordinate {
                coordinate = cityCoordinate
            } else {
                coordinate = try await WidgetLocationProvider.currentCoordinate()
            }

            let dataService = FuelDataService()
            async let history = try? dataService.loadHistory(fuel: configuration.fuel)
            let data = try await dataService.load(fuel: configuration.fuel)
            let fetchedAt = parsedFuelDate(data.fetchedAt)
            guard let selection = selectStations(
                from: data.stations,
                around: coordinate,
                globalMinimumPrice: data.minPrice,
                globalAveragePrice: data.avgPrice,
                globalHistory: await history,
                currentAt: fetchedAt
            ) else {
                return entry(configuration, fetchedAt: fetchedAt, message: "No online stations within 15 km.")
            }
            return FuelWidgetEntry(
                date: .now,
                fuel: configuration.fuel,
                location: configuration.location,
                fetchedAt: fetchedAt,
                content: .loaded(selection)
            )
        } catch {
            return entry(configuration, fetchedAt: nil, message: error.localizedDescription)
        }
    }

    private func entry(_ configuration: FuelWidgetConfiguration, fetchedAt: Date?, message: String) -> FuelWidgetEntry {
        FuelWidgetEntry(
            date: .now,
            fuel: configuration.fuel,
            location: configuration.location,
            fetchedAt: fetchedAt,
            content: .message(message)
        )
    }

    private func previewStation(name: String, price: Double) -> FuelStation {
        FuelStation(
            id: name,
            brand: "Fuel",
            name: name,
            address: "",
            district: "",
            price: price,
            isOffline: false,
            lat: 0,
            lng: 0
        )
    }
}

struct FuelWidgetView: View {
    let entry: FuelWidgetEntry

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            switch entry.content {
            case let .loaded(selection):
                Spacer(minLength: 8)
                priceSummary(selection)
                Spacer(minLength: 8)
                Divider()
                    .overlay(Color.white.opacity(0.24))
                Spacer(minLength: 8)
                nearestView(selection.nearest)
            case let .message(message):
                Spacer(minLength: 8)
                ContentUnavailableView {
                    Label("Fuel prices unavailable", systemImage: "fuelpump")
                } description: {
                    Text(message)
                }
                Spacer(minLength: 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(.white)
        .containerBackground(for: .widget) {
            ZStack {
                LinearGradient(
                    colors: backgroundColors,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                RadialGradient(
                    colors: [glowColor, .clear],
                    center: .topTrailing,
                    startRadius: 0,
                    endRadius: 260
                )
            }
        }
        .widgetURL(fuelMapURL)
    }

    private var backgroundColors: [Color] {
        if colorScheme == .dark {
            return [
                Color(red: 4 / 255, green: 55 / 255, blue: 46 / 255),
                Color(red: 7 / 255, green: 83 / 255, blue: 61 / 255),
                Color(red: 13 / 255, green: 118 / 255, blue: 80 / 255),
            ]
        }
        return [
            Color(red: 7 / 255, green: 95 / 255, blue: 70 / 255),
            Color(red: 17 / 255, green: 132 / 255, blue: 90 / 255),
            Color(red: 58 / 255, green: 168 / 255, blue: 115 / 255),
        ]
    }

    private var glowColor: Color {
        colorScheme == .dark
            ? Color(red: 79 / 255, green: 185 / 255, blue: 130 / 255).opacity(0.28)
            : Color(red: 135 / 255, green: 223 / 255, blue: 172 / 255).opacity(0.35)
    }

    private var secondaryTextColor: Color {
        Color.white.opacity(colorScheme == .dark ? 0.76 : 0.84)
    }

    private var tertiaryTextColor: Color {
        Color.white.opacity(colorScheme == .dark ? 0.58 : 0.68)
    }

    private var lowPriceColor: Color {
        colorScheme == .dark
            ? Color(red: 207 / 255, green: 255 / 255, blue: 104 / 255)
            : Color(red: 223 / 255, green: 255 / 255, blue: 122 / 255)
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: "fuelpump.fill")
                .foregroundStyle(.white)
            Text(entry.fuel.displayName)
                .font(.headline)
            Spacer()
            Text(entry.location.displayName)
                .foregroundStyle(secondaryTextColor)
            if let fetchedAt = entry.fetchedAt {
                Image(systemName: "clock")
                    .font(.caption2)
                    .foregroundStyle(tertiaryTextColor)
                Text(fetchedAt, style: .relative)
                    .foregroundStyle(secondaryTextColor)
            }
        }
        .font(.caption)
        .lineLimit(1)
    }

    private func priceSummary(_ selection: StationSelection) -> some View {
        HStack(alignment: .top, spacing: 12) {
            priceMetric(
                title: "Cyprus low",
                value: selection.globalMinimumPrice,
                emphasized: true,
                trend: selection.minimumPriceTrend
            )
            priceMetric(title: "Cyprus average", value: selection.globalAveragePrice, emphasized: false)
            priceMetric(title: "Nearby average", value: selection.nearbyAveragePrice, emphasized: false)
        }
    }

    private func priceMetric(
        title: String,
        value: Double,
        emphasized: Bool,
        trend: MinimumPriceTrend? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(trend == nil ? title : "\(title) · 24h")
                .font(.caption)
                .foregroundStyle(secondaryTextColor)
                .lineLimit(1)
                .minimumScaleFactor(0.85)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(price(value))
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(emphasized ? lowPriceColor : .white)
                if let trend {
                    minimumTrendView(trend)
                }
            }
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func minimumTrendView(_ trend: MinimumPriceTrend) -> some View {
        HStack(spacing: 2) {
            Image(systemName: trendSymbol(trend.direction))
            if trend.direction != .unchanged {
                Text(price(abs(trend.delta)))
                    .monospacedDigit()
            }
        }
        .font(.caption2.weight(.semibold))
        .foregroundStyle(trendColor(trend.direction))
    }

    private func trendSymbol(_ direction: MinimumPriceTrendDirection) -> String {
        switch direction {
        case .rising: "arrow.up"
        case .falling: "arrow.down"
        case .unchanged: "minus"
        }
    }

    private func trendColor(_ direction: MinimumPriceTrendDirection) -> Color {
        switch direction {
        case .rising:
            Color(red: 1, green: 208 / 255, blue: 189 / 255)
        case .falling:
            Color(red: 185 / 255, green: 244 / 255, blue: 218 / 255)
        case .unchanged:
            secondaryTextColor
        }
    }

    private func nearestView(_ result: StationResult) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "location.fill")
                .font(.caption)
                .foregroundStyle(secondaryTextColor)
                .frame(width: 24, height: 24)
                .background(Color.white.opacity(0.14), in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text("Nearest · \(distance(result.distanceKilometers))")
                    .font(.caption2)
                    .foregroundStyle(secondaryTextColor)
                Text("\(result.station.brand) · \(result.station.name)")
                    .font(.caption.weight(.medium))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Text(price(result.station.price))
                .font(.headline)
                .monospacedDigit()
        }
    }

    private func distance(_ kilometers: Double) -> String {
        kilometers.formatted(.number.precision(.fractionLength(1))) + " km"
    }

    private func price(_ value: Double) -> String {
        value.formatted(.currency(code: "EUR").precision(.fractionLength(3)))
    }
}

struct CyprusFuelWidget: Widget {
    let kind = "CyprusFuelWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: FuelWidgetConfiguration.self, provider: FuelWidgetProvider()) { entry in
            FuelWidgetView(entry: entry)
        }
        .configurationDisplayName("Cyprus Fuel Prices")
        .description("Nearby fuel prices from the Cyprus Retail Fuel Price Observatory.")
        .supportedFamilies([.systemMedium])
    }
}

@main
struct CyprusFuelWidgetBundle: WidgetBundle {
    var body: some Widget {
        CyprusFuelWidget()
    }
}
