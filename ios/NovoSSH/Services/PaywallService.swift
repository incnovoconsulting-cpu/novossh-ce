import SwiftUI

// MARK: - Feature enum

enum PremiumFeature: String, CaseIterable {
    case sessionPlayback  = "Session Playback"
    case analytics        = "Analytics Dashboard"
    case auditLog         = "Audit Log"
    case organizations    = "Organizations & Teams"
    case p2pSessions      = "P2P Sessions"
    case commandPalette   = "Command Palette"
    case portForwarding   = "Port Forwarding"
    case sftpBrowser      = "SFTP Browser"
    case mfa              = "MFA / Security Keys"
    case notifications    = "Push Notifications"
    case vaultEncryption  = "Encrypted Vault"
    case unlimitedHosts   = "Unlimited Hosts"
    case unlimitedVaults  = "Multiple Vaults"
    case unlimitedKeys    = "Unlimited Keys"

    var icon: String {
        switch self {
        case .sessionPlayback:  return "play.rectangle.on.rectangle"
        case .analytics:        return "chart.bar.xaxis"
        case .auditLog:         return "doc.text.magnifyingglass"
        case .organizations:    return "building.2"
        case .p2pSessions:      return "person.2.wave.2"
        case .commandPalette:   return "magnifyingglass"
        case .portForwarding:   return "arrow.left.arrow.right"
        case .sftpBrowser:      return "folder"
        case .mfa:              return "faceid"
        case .notifications:    return "bell.badge"
        case .vaultEncryption:  return "lock.shield"
        case .unlimitedHosts:   return "server.rack"
        case .unlimitedVaults:  return "lock.fill"
        case .unlimitedKeys:    return "key.fill"
        }
    }

    // Minimum plan required
    var requiredPlan: Plan {
        switch self {
        case .commandPalette, .portForwarding, .sftpBrowser, .mfa, .notifications,
             .vaultEncryption, .unlimitedHosts, .unlimitedVaults, .unlimitedKeys,
             .analytics:
            return .starter
        case .sessionPlayback, .auditLog, .p2pSessions:
            return .pro
        case .organizations:
            return .pro  // Enterprise in practice — blocks at UI level
        }
    }
}

// MARK: - Plan

enum Plan: String, Comparable {
    case free, starter, pro

    private var rank: Int {
        switch self { case .free: return 0; case .starter: return 1; case .pro: return 2 }
    }
    static func < (lhs: Plan, rhs: Plan) -> Bool { lhs.rank < rhs.rank }

    var displayName: String {
        switch self { case .free: return "Free"; case .starter: return "Starter"; case .pro: return "Pro" }
    }

    var color: Color {
        switch self { case .free: return Theme.textMuted; case .starter: return Theme.accent; case .pro: return Color(hex: "#8b5cf6") }
    }

    // Hard limits (nil = unlimited)
    var maxHosts: Int? {
        switch self { case .free: return 3; case .starter: return 25; case .pro: return nil }
    }
    var maxVaults: Int? {
        switch self { case .free: return 1; case .starter: return nil; case .pro: return nil }
    }
    var maxKeys: Int? {
        switch self { case .free: return 2; case .starter: return nil; case .pro: return nil }
    }
}

// MARK: - PaywallService

@MainActor
final class PaywallService: ObservableObject {
    static let shared = PaywallService()
    private init() {}

    @Published var currentPlan: Plan = .free

    // Called after BillingService loads subscription
    func sync(from subscription: Subscription?) {
        guard let sub = subscription else { currentPlan = .free; return }
        currentPlan = Plan(rawValue: sub.plan) ?? .free
    }

    func canAccess(_ feature: PremiumFeature) -> Bool {
        currentPlan >= feature.requiredPlan
    }

    func canAddHost(currentCount: Int) -> Bool {
        guard let max = currentPlan.maxHosts else { return true }
        return currentCount < max
    }

    func canAddVault(currentCount: Int) -> Bool {
        guard let max = currentPlan.maxVaults else { return true }
        return currentCount < max
    }

    func canAddKey(currentCount: Int) -> Bool {
        guard let max = currentPlan.maxKeys else { return true }
        return currentCount < max
    }
}

// MARK: - PaywallSheet

struct PaywallSheet: View {
    let feature: PremiumFeature
    let requiredPlan: Plan
    @Environment(\.dismiss) private var dismiss

    init(feature: PremiumFeature) {
        self.feature = feature
        self.requiredPlan = feature.requiredPlan
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()
                VStack(spacing: 28) {
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(requiredPlan.color.opacity(0.12))
                                .frame(width: 80, height: 80)
                            Image(systemName: feature.icon)
                                .font(.system(size: 34))
                                .foregroundStyle(requiredPlan.color)
                        }
                        Text(feature.rawValue)
                            .font(.title2.bold())
                            .foregroundStyle(Theme.textStrong)
                        Text("This feature requires the **\(requiredPlan.displayName)** plan or higher.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Theme.textMuted)
                            .padding(.horizontal, 8)
                    }
                    .padding(.top, 8)

                    // What you get
                    VStack(alignment: .leading, spacing: 10) {
                        Text("What's included in \(requiredPlan.displayName)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.textMuted)
                            .padding(.horizontal, 4)
                        ForEach(planFeatures(for: requiredPlan), id: \.self) { f in
                            HStack(spacing: 10) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(requiredPlan.color)
                                    .font(.subheadline)
                                Text(f)
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.textStrong)
                            }
                        }
                    }
                    .padding(16)
                    .background(Theme.panel)
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.stroke))
                    .padding(.horizontal, 4)

                    Spacer()

                    VStack(spacing: 12) {
                        NavigationLink {
                            BillingView()
                        } label: {
                            Text("Upgrade to \(requiredPlan.displayName)")
                                .font(.body.weight(.semibold))
                                .foregroundStyle(Theme.bg)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(requiredPlan.color)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        Button("Maybe later") { dismiss() }
                            .foregroundStyle(Theme.textMuted)
                            .font(.subheadline)
                    }
                }
                .padding(24)
            }
            .navigationTitle("Upgrade Required")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func planFeatures(for plan: Plan) -> [String] {
        switch plan {
        case .free:
            return ["Up to 3 hosts", "10 snippets", "1 vault", "2 SSH keys", "2 tabs", "Terminal access"]
        case .starter:
            return [
                "Up to 25 hosts", "Unlimited vaults & keys",
                "Port forwarding", "SFTP browser",
                "MFA / security keys", "Analytics",
                "Command palette", "Push notifications"
            ]
        case .pro:
            return [
                "Unlimited hosts & tabs",
                "Session recording & playback",
                "Audit logs",
                "P2P sync",
                "Priority support",
                "Everything in Starter"
            ]
        }
    }
}

// MARK: - Limit banner

struct LimitBanner: View {
    let message: String
    let plan: Plan

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "lock.fill")
                .foregroundStyle(plan.color)
            Text(message)
                .font(.caption)
                .foregroundStyle(Theme.textMuted)
            Spacer()
            NavigationLink {
                BillingView()
            } label: {
                Text("Upgrade")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(plan.color)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(plan.color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(plan.color.opacity(0.2)))
    }
}
