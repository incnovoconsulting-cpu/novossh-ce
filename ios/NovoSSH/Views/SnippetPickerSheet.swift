import SwiftUI

struct SnippetPickerSheet: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    let onPick: (Snippet) -> Void

    var filtered: [Snippet] {
        guard !query.isEmpty else { return store.snippets }
        return store.snippets.filter {
            $0.label.localizedCaseInsensitiveContains(query) ||
            $0.command.localizedCaseInsensitiveContains(query) ||
            $0.tags.contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(filtered) { s in
                    Button {
                        onPick(s)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(s.label).font(.body).foregroundStyle(.white)
                            Text(s.command)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.6))
                                .lineLimit(1)
                            if !s.tags.isEmpty {
                                HStack(spacing: 4) {
                                    ForEach(s.tags, id: \.self) { t in
                                        Text(t)
                                            .font(.caption2)
                                            .padding(.horizontal, 6).padding(.vertical, 2)
                                            .background(.white.opacity(0.06))
                                            .clipShape(Capsule())
                                    }
                                }
                            }
                        }
                    }
                    .listRowBackground(Theme.panel)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            #if os(iOS)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
            #else
            .searchable(text: $query)
            #endif
            .navigationTitle("Pick a snippet")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}
