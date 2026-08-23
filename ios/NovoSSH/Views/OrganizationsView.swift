import SwiftUI

struct OrganizationsView: View {
    @StateObject private var service = OrganizationService.shared
    @State private var showCreate = false

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            Group {
                if service.isLoading && service.organizations.isEmpty {
                    ProgressView().tint(Theme.accent)
                } else if service.organizations.isEmpty {
                    EmptyOrgView(onCreateTap: { showCreate = true })
                } else {
                    orgList
                }
            }
        }
        .navigationTitle("Organizations")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCreate = true } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .task { await service.fetchOrganizations() }
        .refreshable { await service.fetchOrganizations() }
        .sheet(isPresented: $showCreate) {
            CreateOrgSheet(onCreated: { _ in
                Task { await service.fetchOrganizations() }
            })
        }
        .alert("Error", isPresented: .constant(service.error != nil), presenting: service.error) { _ in
            Button("OK") { service.error = nil }
        } message: { err in Text(err) }
    }

    private var orgList: some View {
        List {
            ForEach(service.organizations) { org in
                NavigationLink(value: org) {
                    OrgRow(org: org)
                }
                .listRowBackground(Theme.panel)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .navigationDestination(for: Organization.self) { org in
            OrgDetailView(org: org)
        }
    }
}

// MARK: - Row

private struct OrgRow: View {
    let org: Organization

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(org.name)
                .font(.body.weight(.medium))
                .foregroundStyle(Theme.textStrong)
            Text("@\(org.slug)")
                .font(.caption)
                .foregroundStyle(Theme.accent)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Empty state

private struct EmptyOrgView: View {
    let onCreateTap: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "building.2")
                .font(.system(size: 48))
                .foregroundStyle(Theme.textStrong.opacity(0.25))
            Text("No Organizations")
                .font(.headline)
                .foregroundStyle(Theme.textStrong)
            Text("Create an organization to manage teams and members.")
                .font(.subheadline)
                .foregroundStyle(Theme.textStrong.opacity(0.5))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button("Create Organization") { onCreateTap() }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
        }
    }
}

// MARK: - Create org sheet

struct CreateOrgSheet: View {
    let onCreated: (Organization) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var service = OrganizationService.shared
    @State private var name = ""
    @State private var slug = ""
    @State private var description = ""
    @State private var isSaving = false

    private var slugSuggestion: String {
        name.lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .filter { $0.isLetter || $0.isNumber || $0 == "-" }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Organization name", text: $name)
                        .onChange(of: name) { _, _ in
                            if slug.isEmpty { slug = slugSuggestion }
                        }
                    HStack {
                        Text("@").foregroundStyle(Theme.textStrong.opacity(0.5))
                        TextField("slug", text: $slug)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }
                    TextField("Description (optional)", text: $description)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("New Organization")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await createOrg() } }
                        .disabled(name.isEmpty || slug.isEmpty || isSaving)
                }
            }
            .overlay {
                if isSaving { ProgressView().tint(Theme.accent) }
            }
        }
    }

    private func createOrg() async {
        isSaving = true
        defer { isSaving = false }
        if let org = await service.createOrganization(
            name: name,
            slug: slug,
            description: description.isEmpty ? nil : description
        ) {
            onCreated(org)
            dismiss()
        }
    }
}
