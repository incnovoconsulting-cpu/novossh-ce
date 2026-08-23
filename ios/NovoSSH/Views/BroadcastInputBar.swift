import SwiftUI

struct BroadcastInputBar: View {
    @Binding var text: String
    let onSend: (String) -> Void

    var body: some View {
        HStack(spacing: 8) {
            Text("BROADCAST")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(Theme.accent)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(Theme.accent.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 4))

            TextField("Type to send to all sessions…", text: $text)
                .textFieldStyle(.plain)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(Theme.textStrong)
                .onSubmit { onSend(text) }
                .submitLabel(.send)

            Button {
                onSend(text)
            } label: {
                Image(systemName: "dot.radiowaves.right")
                    .foregroundStyle(text.isEmpty ? Theme.textStrong.opacity(0.3) : Theme.accent)
            }
            .disabled(text.isEmpty)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Theme.accent.opacity(0.06))
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.accent.opacity(0.2)).frame(height: 1)
        }
    }
}
