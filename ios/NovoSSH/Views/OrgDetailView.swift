import SwiftUI

struct OrgDetailView: View {
    let org: Organization
    @StateObject private var service = OrganizationService.shared
    @State private var selectedTab = 0
    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack { Theme.bg.ignoresSafeArea() }
            .overlay {
                VStack(spacing: 0) {
                    // Tab picker
                    Picker("Tab", selection: $selectedTab) {
                        Text("Members").tag(0)
                        Text("Teams").tag(1)
                    }
                    .pickerStyle(.segmented)
                    .padding()

                    if selectedTab == 0 {
                        MembersTab(orgId: org.id)
                    } else {
                        TeamsTab(orgId: org.id)
                    }
                }
            }
            .navigationTitle(org.name)
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { showEdit = true } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Button(role: .destructive) { showDeleteConfirm = true } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
            .sheet(isPresented: $showEdit) {
                EditOrgSheet(org: org)
            }
            .confirmationDialog("Delete \(org.name)?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        await service.deleteOrganization(id: org.id)
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This action cannot be undone.")
            }
    }
}

// MARK: - Members tab

private struct MembersTab: View {
    let orgId: String
    @StateObject private var service = OrganizationService.shared
    @State private var showRoleSheet = false
    @State private var editingMember: OrgMember?

    var body: some View {
        Group {
            if service.isLoading && service.members.isEmpty {
                ProgressView().tint(Theme.accent).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if service.members.isEmpty {
                Text("No members")
                    .foregroundStyle(Theme.textStrong.opacity(0.4))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(service.members) { member in
                        MemberRow(member: member)
                            .listRowBackground(Theme.panel)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await service.removeMember(orgId: orgId, memberId: member.id) }
                                } label: {
                                    Label("Remove", systemImage: "person.badge.minus")
                                }

                                Button {
                                    editingMember = member
                                    showRoleSheet = true
                                } label: {
                                    Label("Role", systemImage: "person.badge.key")
                                }
                                .tint(Theme.accent)
                            }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .task { await service.fetchMembers(orgId: orgId) }
        .refreshable { await service.fetchMembers(orgId: orgId) }
        .sheet(isPresented: $showRoleSheet) {
            if let member = editingMember {
                RolePickerSheet(currentRole: member.role) { newRole in
                    Task { await service.updateMemberRole(orgId: orgId, memberId: member.id, role: newRole) }
                }
            }
        }
    }
}

private struct MemberRow: View {
    let member: OrgMember

    var body: some View {
        HStack {
            Circle()
                .fill(Theme.accent.opacity(0.2))
                .frame(width: 36, height: 36)
                .overlay {
                    Text(String((member.username ?? member.email ?? "?").prefix(1)).uppercased())
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.accent)
                }
            VStack(alignment: .leading, spacing: 2) {
                Text(member.username ?? member.email ?? member.userId)
                    .font(.body)
                    .foregroundStyle(Theme.textStrong)
                if let email = member.email {
                    Text(email)
                        .font(.caption)
                        .foregroundStyle(Theme.textStrong.opacity(0.5))
                }
            }
            Spacer()
            RoleBadge(role: member.role)
        }
    }
}

private struct RoleBadge: View {
    let role: String

    private var color: Color {
        switch role {
        case "owner": return .orange
        case "admin": return Theme.accent
        default: return Theme.textStrong.opacity(0.4)
        }
    }

    var body: some View {
        Text(role)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(Capsule())
    }
}

private struct RolePickerSheet: View {
    let currentRole: String
    let onSelect: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    private let roles = ["owner", "admin", "member", "viewer"]

    var body: some View {
        NavigationStack {
            List(roles, id: \.self) { role in
                Button {
                    onSelect(role)
                    dismiss()
                } label: {
                    HStack {
                        Text(role.capitalized).foregroundStyle(Theme.textStrong)
                        Spacer()
                        if role == currentRole {
                            Image(systemName: "checkmark").foregroundStyle(Theme.accent)
                        }
                    }
                }
                .listRowBackground(Theme.panel)
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Change Role")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Teams tab

private struct TeamsTab: View {
    let orgId: String
    @StateObject private var service = OrganizationService.shared
    @State private var showCreate = false

    var body: some View {
        Group {
            if service.isLoading && service.teams.isEmpty {
                ProgressView().tint(Theme.accent).frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if service.teams.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "person.3").font(.system(size: 40)).foregroundStyle(Theme.textStrong.opacity(0.2))
                    Text("No Teams").foregroundStyle(Theme.textStrong.opacity(0.4))
                    Button("Create Team") { showCreate = true }
                        .buttonStyle(.bordered).tint(Theme.accent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(service.teams) { team in
                        TeamRow(team: team)
                            .listRowBackground(Theme.panel)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { await service.deleteTeam(id: team.id) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                    }
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
            }
        }
        .task { await service.fetchTeams() }
        .refreshable { await service.fetchTeams() }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showCreate = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showCreate) {
            CreateTeamSheet(onCreated: { _ in })
        }
    }
}

private struct TeamRow: View {
    let team: Team

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(team.name)
                .font(.body.weight(.medium))
                .foregroundStyle(Theme.textStrong)
            if let desc = team.description {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(Theme.textStrong.opacity(0.5))
                    .lineLimit(1)
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Create team sheet

struct CreateTeamSheet: View {
    let onCreated: (Team) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var service = OrganizationService.shared
    @State private var name = ""
    @State private var description = ""
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Team name", text: $name)
                    TextField("Description (optional)", text: $description)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("New Team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { Task { await createTeam() } }
                        .disabled(name.isEmpty || isSaving)
                }
            }
        }
    }

    private func createTeam() async {
        isSaving = true; defer { isSaving = false }
        if let team = await service.createTeam(
            name: name,
            description: description.isEmpty ? nil : description
        ) {
            onCreated(team)
            dismiss()
        }
    }
}

// MARK: - Edit org sheet

struct EditOrgSheet: View {
    let org: Organization
    @Environment(\.dismiss) private var dismiss
    @StateObject private var service = OrganizationService.shared
    @State private var name: String
    @State private var description: String
    @State private var isSaving = false

    init(org: Organization) {
        self.org = org
        _name = State(initialValue: org.name)
        _description = State(initialValue: org.description ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Organization name", text: $name)
                    TextField("Description (optional)", text: $description)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Edit Organization")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { Task { await save() } }
                        .disabled(name.isEmpty || isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true; defer { isSaving = false }
        await service.updateOrganization(
            id: org.id,
            name: name,
            description: description.isEmpty ? nil : description
        )
        dismiss()
    }
}
