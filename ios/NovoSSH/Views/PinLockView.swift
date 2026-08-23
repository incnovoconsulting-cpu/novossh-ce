import SwiftUI

/// PIN lock screen for app-level and vault-level authentication.
struct PinLockView: View {
    @EnvironmentObject private var store: AppStore
    @State private var pin = ""
    @State private var error = ""
    @State private var confirmPin = ""

    let isSetup: Bool
    let onSuccess: () -> Void

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "lock.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.accent)

            Text(isSetup ? "Set PIN" : "Enter PIN")
                .font(.title2.bold())
                .foregroundStyle(Theme.textStrong)

            Text(isSetup ? "Create a 4-6 digit PIN" : "Enter your PIN to unlock")
                .font(.subheadline)
                .foregroundStyle(Theme.textMuted)

            // PIN dots
            HStack(spacing: 12) {
                ForEach(0..<6, id: \.self) { i in
                    Circle()
                        .fill(i < pin.count ? Theme.accent : Theme.strokeMid)
                        .frame(width: 14, height: 14)
                }
            }
            .padding(.vertical, 20)

            if !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Theme.danger)
            }

            // Number pad
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 16) {
                ForEach(1...9, id: \.self) { num in
                    pinButton("\(num)")
                }
                pinButton("")  // empty
                pinButton("0")
                pinButton(deleteIcon)
            }
            .padding(.horizontal, 40)

            Spacer()
        }
        .background(Theme.bg.ignoresSafeArea())
    }

    private func pinButton(_ label: String) -> some View {
        Button {
            if label == deleteIcon {
                if !pin.isEmpty { pin.removeLast() }
            } else if !label.isEmpty {
                let maxLen = isSetup ? 6 : store.savedPinLength
                if pin.count < maxLen {
                    pin.append(label)
                    if pin.count == maxLen {
                        validatePin()
                    }
                }
            }
        } label: {
            if label == deleteIcon {
                Image(systemName: "delete.left")
                    .font(.title2)
                    .foregroundStyle(Theme.textMuted)
            } else if label.isEmpty {
                Color.clear.frame(height: 44)
            } else {
                Text(label)
                    .font(.title2.bold())
                    .foregroundStyle(Theme.textStrong)
                    .frame(width: 72, height: 72)
                    .background(Theme.panel)
                    .clipShape(Circle())
            }
        }
        .disabled(label.isEmpty)
    }

    private var deleteIcon: String { "delete.left" }

    private func validatePin() {
        if isSetup {
            if confirmPin.isEmpty {
                confirmPin = pin
                pin = ""
                error = "Confirm your PIN"
            } else if pin == confirmPin {
                store.savePin(pin)
                store.isPinSet = true
                onSuccess()
            } else {
                error = "PINs don't match. Try again."
                pin = ""
                confirmPin = ""
            }
        } else {
            if store.validatePin(pin) {
                pin = ""
                onSuccess()
            } else {
                error = "Incorrect PIN"
                pin = ""
            }
        }
    }
}
