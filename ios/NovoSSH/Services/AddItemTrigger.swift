import Foundation

/// Signals each tab view to open its "add" sheet.
/// Toggled by the outer NavigationStack's + button in RootView.
@MainActor
final class AddItemTrigger: ObservableObject {
    static let shared = AddItemTrigger()
    @Published var host = false
    @Published var vault = false
    @Published var snippet = false
    @Published var key = false
    private init() {}
}
