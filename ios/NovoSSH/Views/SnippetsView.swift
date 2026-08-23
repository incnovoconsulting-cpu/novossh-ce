import SwiftUI

struct SnippetsView: View {
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var addTrigger: AddItemTrigger
    @State private var query = ""
    @State private var showNew = false

    var filtered: [Snippet] {
        guard !query.isEmpty else { return store.snippets }
        return store.snippets.filter {
            $0.label.localizedCaseInsensitiveContains(query)
            || $0.command.localizedCaseInsensitiveContains(query)
            || $0.tags.contains { $0.localizedCaseInsensitiveContains(query) }
        }
    }

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            List {
                ForEach(filtered) { s in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.label).foregroundStyle(.white)
                        Text(s.command)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.7))
                            .padding(.horizontal, 8).padding(.vertical, 6)
                            .background(Color.black.opacity(0.3))
                            .clipShape(RoundedRectangle(cornerRadius: 6))
                        if let d = s.description, !d.isEmpty {
                            Text(d).font(.caption).foregroundStyle(.white.opacity(0.5))
                        }
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
                    .padding(.vertical, 4)
                    .listRowBackground(Theme.panel)
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            store.deleteSnippet(s.id)
                        } label: { Label("Delete", systemImage: "trash") }
                        Button {
                            ClipboardHelper.setString(s.command)
                        } label: { Label("Copy", systemImage: "doc.on.doc") }
                            .tint(Theme.accent)
                    }
                }
            }
            .scrollContentBackground(.hidden)
        }
        .navigationTitle("Snippets")
        #if os(iOS)
        .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always))
        #else
        .searchable(text: $query)
        #endif
        .onChange(of: addTrigger.snippet) { _, _ in showNew = true }
        .sheet(isPresented: $showNew) {
            NewSnippetView()
        }
    }
}

struct NewSnippetView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var label = ""
    @State private var command = ""
    @State private var description = ""
    @State private var tagsText = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Snippet") {
                    TextField("Label", text: $label)
                    TextField("Command", text: $command, axis: .vertical)
                        .font(.system(.body, design: .monospaced))
                        .lineLimit(2...8)
                        .textInputAutocapitalization(.never)
                    TextField("Description (optional)", text: $description)
                    TextField("Tags (comma separated)", text: $tagsText)
                        .textInputAutocapitalization(.never)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("New snippet")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let tags = tagsText.split(separator: ",")
                            .map { $0.trimmingCharacters(in: .whitespaces) }
                            .filter { !$0.isEmpty }
                        store.addSnippet(Snippet(label: label,
                                                 command: command,
                                                 description: description.isEmpty ? nil : description,
                                                 tags: tags))
                        dismiss()
                    }
                    .disabled(label.isEmpty || command.isEmpty)
                }
            }
        }
    }
}
