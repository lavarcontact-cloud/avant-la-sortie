import SwiftUI

struct PairingView: View {
    @EnvironmentObject private var sync: SyncCoordinator
    @State private var server = UserDefaults.standard.url(forKey: "serverURL")?.absoluteString ?? "https://"
    @State private var code = ""
    @State private var busy = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Ouvre le dashboard SNAP CLIP FACTORY sur ton ordinateur, clique sur « Appairer un appareil » et saisis le code affiché.")
                        .font(.callout).foregroundStyle(.secondary)
                }
                Section("Serveur") {
                    TextField("https://…", text: $server)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                }
                Section("Code d'appairage") {
                    TextField("8 caractères", text: $code)
                        .textInputAutocapitalization(.characters).autocorrectionDisabled()
                        .font(.system(.title2, design: .monospaced))
                }
                if let err = sync.lastError {
                    Section { Text(err).foregroundStyle(.red).font(.footnote) }
                }
                Section {
                    Button {
                        guard let url = URL(string: server.trimmingCharacters(in: .whitespaces)) else { return }
                        busy = true
                        Task { await sync.pair(server: url, code: code); busy = false }
                    } label: {
                        HStack { Spacer(); if busy { ProgressView() } else { Text("Appairer cet iPhone").bold() }; Spacer() }
                    }
                    .disabled(code.count != 8 || busy)
                }
            }
            .navigationTitle("Snap Clip")
        }
    }
}
