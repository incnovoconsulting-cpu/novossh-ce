import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject private var store: AppStore
    @State private var page = 0
    let onDismiss: () -> Void

    private let steps: [(icon: String, title: String, desc: String)] = [
        ("desktopcomputer", "Add Your First Host", "Connect to any SSH server. Save hosts with labels, colors, and auth methods for quick access."),
        ("terminal", "Full Terminal", "A real terminal with xterm-256color support, bold/underline text, and ANSI colors."),
        ("lock.fill", "Secure Vault", "Store credentials, SSH keys, and notes in encrypted vaults. Share with your team securely."),
        ("folder.fill", "SFTP Browser", "Browse, upload, and download files from remote servers. Drag-and-drop simplicity."),
        ("command", "Command Snippets", "Save and reuse commands across hosts. Organize by package and search instantly."),
    ]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Skip") { onDismiss() }
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            TabView(selection: $page) {
                ForEach(0..<steps.count, id: \.self) { i in
                    let step = steps[i]
                    VStack(spacing: 24) {
                        Spacer()
                        Image(systemName: step.icon)
                            .font(.system(size: 48))
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 80, height: 80)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(Circle())
                        Text(step.title)
                            .font(.title2.bold())
                            .multilineTextAlignment(.center)
                        Text(step.desc)
                            .font(.body)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Spacer()
                    }
                    .tag(i)
                }
            }
            #if os(iOS)
            .tabViewStyle(.page(indexDisplayMode: .never))
            #endif

            HStack(spacing: 8) {
                ForEach(0..<steps.count, id: \.self) { i in
                    Capsule()
                        .fill(i == page ? Color.accentColor : Color.gray.opacity(0.3))
                        .frame(width: i == page ? 24 : 8, height: 8)
                }
            }
            .padding(.vertical, 16)

            Button {
                if page < steps.count - 1 {
                    withAnimation { page += 1 }
                } else {
                    store.updateSettings(store.settings.copy(with: \.hasSeenOnboarding, value: true))
                    onDismiss()
                }
            } label: {
                Text(page < steps.count - 1 ? "Next" : "Get Started")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(Color.accentColor)
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
    }
}

private extension UserSettings {
    func copy<T>(with keyPath: WritableKeyPath<UserSettings, T>, value: T) -> UserSettings {
        var copy = self
        copy[keyPath: keyPath] = value
        return copy
    }
}
