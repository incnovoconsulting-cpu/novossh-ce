import Foundation

struct Organization: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let slug: String
    let description: String?
    let logo_url: String?
    let parent_id: String?
    let created_at: String
}

struct OrgMember: Identifiable, Decodable {
    let id: String
    let userId: String
    let role: String
    let email: String?
    let username: String?
    let joinedAt: String?
}

struct OrgListResponse: Decodable {
    let organizations: [Organization]
    let total: Int
}

struct OrgMembersResponse: Decodable {
    let members: [OrgMember]
    let total: Int
}

struct Team: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let description: String?
    let organizationId: String?
    let created_at: String?
}

struct TeamMember: Identifiable, Decodable {
    let id: String
    let userId: String
    let role: String
    let email: String?
    let username: String?
}

@MainActor
final class OrganizationService: ObservableObject {
    static let shared = OrganizationService()

    @Published var organizations: [Organization] = []
    @Published var selectedOrg: Organization?
    @Published var members: [OrgMember] = []
    @Published var teams: [Team] = []
    @Published var teamMembers: [TeamMember] = []
    @Published var isLoading = false
    @Published var error: String?

    private init() {}

    // MARK: - Organizations

    func fetchOrganizations() async {
        guard let url = apiURL("/api/organizations") else { return }
        isLoading = true; defer { isLoading = false }
        do {
            let data = try await get(url)
            let resp = try JSONDecoder().decode(OrgListResponse.self, from: data)
            organizations = resp.organizations
        } catch { self.error = error.localizedDescription }
    }

    func createOrganization(name: String, slug: String, description: String?) async -> Organization? {
        guard let url = apiURL("/api/organizations") else { return nil }
        var body: [String: Any] = ["name": name, "slug": slug]
        if let d = description { body["description"] = d }
        do {
            let data = try await post(url, body: body)
            return try JSONDecoder().decode(Organization.self, from: data)
        } catch { self.error = error.localizedDescription; return nil }
    }

    func updateOrganization(id: String, name: String, description: String?) async {
        guard let url = apiURL("/api/organizations/\(id)") else { return }
        var body: [String: Any] = ["name": name]
        if let d = description { body["description"] = d }
        do {
            let data = try await patch(url, body: body)
            if let updated = try? JSONDecoder().decode(Organization.self, from: data) {
                organizations = organizations.map { $0.id == id ? updated : $0 }
                if selectedOrg?.id == id { selectedOrg = updated }
            }
        } catch { self.error = error.localizedDescription }
    }

    func deleteOrganization(id: String) async {
        guard let url = apiURL("/api/organizations/\(id)") else { return }
        do {
            try await delete(url)
            organizations.removeAll { $0.id == id }
            if selectedOrg?.id == id { selectedOrg = nil }
        } catch { self.error = error.localizedDescription }
    }

    // MARK: - Members

    func fetchMembers(orgId: String) async {
        guard let url = apiURL("/api/organizations/\(orgId)/members") else { return }
        isLoading = true; defer { isLoading = false }
        do {
            let data = try await get(url)
            let resp = try JSONDecoder().decode(OrgMembersResponse.self, from: data)
            members = resp.members
        } catch { self.error = error.localizedDescription }
    }

    func removeMember(orgId: String, memberId: String) async {
        guard let url = apiURL("/api/organizations/\(orgId)/members/\(memberId)") else { return }
        do {
            try await delete(url)
            members.removeAll { $0.id == memberId }
        } catch { self.error = error.localizedDescription }
    }

    func updateMemberRole(orgId: String, memberId: String, role: String) async {
        guard let url = apiURL("/api/organizations/\(orgId)/members/\(memberId)") else { return }
        do {
            let data = try await patch(url, body: ["role": role])
            if let updated = try? JSONDecoder().decode(OrgMember.self, from: data) {
                members = members.map { $0.id == memberId ? updated : $0 }
            }
        } catch { self.error = error.localizedDescription }
    }

    // MARK: - Teams

    func fetchTeams() async {
        guard let url = apiURL("/api/teams") else { return }
        isLoading = true; defer { isLoading = false }
        do {
            let data = try await get(url)
            teams = try JSONDecoder().decode([Team].self, from: data)
        } catch { self.error = error.localizedDescription }
    }

    func createTeam(name: String, description: String?) async -> Team? {
        guard let url = apiURL("/api/teams") else { return nil }
        var body: [String: Any] = ["name": name]
        if let d = description { body["description"] = d }
        do {
            let data = try await post(url, body: body)
            let team = try JSONDecoder().decode(Team.self, from: data)
            teams.append(team)
            return team
        } catch { self.error = error.localizedDescription; return nil }
    }

    func deleteTeam(id: String) async {
        guard let url = apiURL("/api/teams/\(id)") else { return }
        do {
            try await delete(url)
            teams.removeAll { $0.id == id }
        } catch { self.error = error.localizedDescription }
    }

    // MARK: - HTTP helpers

    private func apiURL(_ path: String) -> URL? {
        let base = APIService.shared.baseURL
        guard !base.isEmpty else { return nil }
        return URL(string: base + path)
    }

    private func get(_ url: URL) async throws -> Data {
        let req = URLRequest(url: url)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func post(_ url: URL, body: [String: Any]) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func patch(_ url: URL, body: [String: Any]) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await APIService.shared.authenticatedData(for: req)
        return data
    }

    private func delete(_ url: URL) async throws {
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        _ = try await APIService.shared.authenticatedData(for: req)
    }
}
