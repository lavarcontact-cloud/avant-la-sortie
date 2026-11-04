import SwiftUI

struct VideoListView: View {
    @EnvironmentObject private var sync: SyncCoordinator
    @State private var filter: Filter = .all

    enum Filter: String, CaseIterable { case all = "Toutes", pending = "En attente", synced = "Synchronisées", failed = "Échecs" }

    private var rows: [SyncItem] {
        sync.items.values
            .filter {
                switch filter {
                case .all: true
                case .pending: $0.state.isPending
                case .synced: $0.state.isSynced
                case .failed: $0.state == .failed
                }
            }
            .sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    var body: some View {
        NavigationStack {
            List {
                Picker("Filtre", selection: $filter) {
                    ForEach(Filter.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                ForEach(rows.prefix(500)) { item in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: item.origin == .photos ? "photo.on.rectangle" : "square.and.arrow.down")
                                .foregroundStyle(.secondary)
                            Text(item.filename).lineLimit(1)
                            Spacer()
                            Text(item.state.label).font(.caption.bold())
                                .foregroundStyle(item.state == .failed ? .red : item.state.isSynced ? .green : .orange)
                        }
                        HStack(spacing: 8) {
                            if let d = item.createdAt { Text(d.formatted(date: .abbreviated, time: .shortened)) }
                            if let s = item.sizeBytes { Text(ByteCountFormatter.string(fromByteCount: s, countStyle: .file)) }
                            if let d = item.durationS { Text(Duration.seconds(d).formatted(.time(pattern: .minuteSecond))) }
                        }
                        .font(.caption).foregroundStyle(.secondary)
                        if item.state == .uploading { ProgressView(value: item.progress) }
                        if let e = item.error { Text(e).font(.caption2).foregroundStyle(.red).lineLimit(2) }
                    }
                }
            }
            .navigationTitle("Vidéos")
            .toolbar {
                if sync.failedCount > 0 {
                    Button("Relancer les échecs") { Task { await sync.retryFailed() } }
                }
            }
        }
    }
}
