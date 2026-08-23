import StoreKit
import Foundation

// Product IDs must match what you configure in App Store Connect.
// Format: com.novossh.<plan>.<cycle>
enum IAPProduct: String, CaseIterable {
    case starterMonthly = "com.novossh.starter.monthly"
    case starterAnnual  = "com.novossh.starter.annual"
    case proMonthly     = "com.novossh.pro.monthly"
    case proAnnual      = "com.novossh.pro.annual"

    var plan: String {
        switch self {
        case .starterMonthly, .starterAnnual: return "starter"
        case .proMonthly, .proAnnual:         return "pro"
        }
    }

    var displayName: String {
        switch self {
        case .starterMonthly: return "Starter – Monthly"
        case .starterAnnual:  return "Starter – Annual"
        case .proMonthly:     return "Pro – Monthly"
        case .proAnnual:      return "Pro – Annual"
        }
    }
}

@MainActor
final class StoreKitService: ObservableObject {
    static let shared = StoreKitService()

    @Published var products: [Product] = []
    @Published var isPurchasing = false
    @Published var purchaseError: String?

    private var updateListenerTask: Task<Void, Never>?

    private init() {
        updateListenerTask = listenForTransactions()
    }

    deinit { updateListenerTask?.cancel() }

    /// True once `loadProducts()` has completed at least one round trip, so the UI can
    /// distinguish "still loading" from "loaded but StoreKit returned nothing".
    @Published var didLoadProducts = false

    func loadProducts() async {
        do {
            let fetched = try await Self.withTimeout(seconds: 10) {
                try await Product.products(for: IAPProduct.allCases.map(\.rawValue))
            }
            products = fetched.sorted { $0.price < $1.price }
            // An empty list here almost always means the Paid Applications Agreement
            // isn't active yet (or the products aren't approved) — surface it instead of
            // failing silently, otherwise every purchase attempt shows a vague error.
            if products.isEmpty {
                purchaseError = "In-app purchases are temporarily unavailable. Please try again later or contact support@novossh.com."
                print("[StoreKitService] loadProducts returned 0 products for \(IAPProduct.allCases.map(\.rawValue)) — check Paid Apps Agreement / product approval state")
            }
        } catch {
            // Guideline 2.1(a): the Subscription page must never spin forever — a hung or
            // slow StoreKit call (rejected once for exactly this: "loaded indefinitely at
            // the Subscription page") now surfaces as an error within 10s instead.
            purchaseError = "Couldn't load subscription options: \(error.localizedDescription)"
            print("[StoreKitService] loadProducts failed: \(error)")
        }
        didLoadProducts = true
    }

    /// Races `operation` against a timeout so a hung underlying call can't block the
    /// caller forever; throws `CancellationError` if the timeout wins.
    private static func withTimeout<T: Sendable>(
        seconds: TimeInterval,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw CancellationError()
            }
            defer { group.cancelAll() }
            let result = try await group.next()!
            return result
        }
    }

    func purchase(_ product: Product) async -> Bool {
        isPurchasing = true; defer { isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                // Send the signed JWS (not the decoded jsonRepresentation) so the server
                // can verify it. Report BEFORE finishing so the plan is upgraded first.
                await reportToServer(jws: verification.jwsRepresentation)
                await transaction.finish()
                return true
            case .userCancelled:
                return false
            case .pending:
                return false
            @unknown default:
                return false
            }
        } catch {
            if case StoreKitError.userCancelled = error { return false }
            purchaseError = error.localizedDescription
            return false
        }
    }

    func restorePurchases() async {
        isPurchasing = true; defer { isPurchasing = false }
        var restoredCount = 0
        // Iterate current entitlements to restore active subscriptions
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result {
                await reportToServer(jws: result.jwsRepresentation)
                await transaction.finish()
                restoredCount += 1
            }
        }
        await BillingService.shared.fetchAll()
        if restoredCount == 0 {
            purchaseError = "No active purchases found to restore."
        }
    }

    // MARK: - Private

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error): throw error
        case .verified(let value):      return value
        }
    }

    private func listenForTransactions() -> Task<Void, Never> {
        Task.detached(priority: .background) { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                do {
                    let transaction = try await self.checkVerified(result)
                    await self.reportToServer(jws: result.jwsRepresentation)
                    await transaction.finish()
                } catch {
                    print("[StoreKit] Transaction update unverified: \(error)")
                }
            }
        }
    }

    /// Posts the signed StoreKit 2 JWS to the server for verification + plan upgrade,
    /// then refreshes billing so the UI reflects the new plan. Order matters: the plan
    /// only changes after the server processes the transaction, so fetch AFTER the POST.
    private func reportToServer(jws: String) async {
        guard let url = URL(string: APIService.shared.baseURL + "/api/billing/apple/verify") else { return }
        do {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["transactionJWS": jws])
            let (data, response) = try await APIService.shared.authenticatedData(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"] ?? "verification failed"
                purchaseError = "Couldn't confirm your purchase: \(msg)"
                print("[StoreKit] verify HTTP \(http.statusCode): \(msg)")
            }
        } catch {
            print("[StoreKit] Server report failed: \(error)")
        }
        // Refresh billing after the server has processed the transaction.
        await BillingService.shared.fetchAll()
    }
}
