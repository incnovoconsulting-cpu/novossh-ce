import SwiftUI

// Removes the default inset from List/Form on iOS 26 liquid glass builds.
// Kept as a no-op stub so the project reference resolves on all SDK versions.
extension View {
    @ViewBuilder
    func fixTableInset() -> some View {
        self
    }
}
