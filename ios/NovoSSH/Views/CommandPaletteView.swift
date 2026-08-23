import SwiftUI

struct CommandPaletteView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    let onConnect: (Host) -> Void

    private var filtered: [Host] {
        guard !query.isEmpty else { return store.hosts }
        return store.hosts.filter {
            $0.label.localizedCaseInsensitiveContains(query) ||
            $0.address.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()
                List {
                    if !filtered.isEmpty {
                        Section("Hosts") {
                            ForEach(filtered) { host in
                                Button {
                                    dismiss()
                                    onConnect(host)
                                } label: {
                                    HStack(spacing: 12) {
                                        Circle()
                                            .fill(Color(hex: host.colorHex ?? "#39ff14"))
                                            .frame(width: 8, height: 8)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(host.label)
                                                .foregroundStyle(Theme.textStrong)
                                                .font(.subheadline.weight(.medium))
                                            Text("\(host.username)@\(host.address):\(host.port)")
                                                .foregroundStyle(Theme.textStrong.opacity(0.5))
                                                .font(.caption)
                                                .fontDesign(.monospaced)
                                        }
                                        Spacer()
                                        Image(systemName: "terminal")
                                            .foregroundStyle(Theme.accent)
                                            .font(.caption)
                                    }
                                }
                                .listRowBackground(Theme.panel)
                            }
                        }
                    }

                    Section("Actions") {
                        ActionRow(icon: "plus.circle", label: "New Host") { dismiss() }
                        ActionRow(icon: "folder", label: "SFTP Browser") { dismiss() }
                        ActionRow(icon: "arrow.left.arrow.right", label: "Port Forwarding") { dismiss() }
                    }
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Command Palette")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search hosts or commands…")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }.foregroundStyle(Theme.accent)
                }
            }
        }
    }
}

private struct ActionRow: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).foregroundStyle(Theme.accent).frame(width: 20)
                Text(label).foregroundStyle(Theme.textStrong)
            }
        }
        .listRowBackground(Theme.panel)
    }
}
