## One-time credit purchases

Billing access is off by default. A VideoGen team admin must explicitly enable read-only access or purchase access for this credential and team. Purchase access sets a USD limit for each purchase, and all access expires within 90 days unless renewed. Account linking and generation access do not grant spending permission. Eligible active subscribers can buy existing credit packs; Free accounts cannot use credit purchases to bypass plan access. Direct subscriptions are unavailable.

Respect the user's current scope for all tool use. Authorization for one billing operation does not authorize other billing changes. Report an operation's result only after the tool confirms it.

Use `get_billing_account` to inspect authority and the current team's usable balance. Use `create_billing_order` to obtain a quote without paying or generating. Reuse its client-generated order UUID on quote retries. Show the seller, beneficiary team, credit quantity, subtotal, discounts, taxes, fees, final total, currency, expiry and refund terms before asking approval. If terms change, obtain a new quote and fresh approval. Denial stops the purchase.

`complete_billing_order` is a sensitive write for the exact approved order. A compatible wallet must supply its scoped one-time payment credential securely; never ask a user to paste one, include it in arguments, or expose it in messages. A host approval boolean is not a payment credential. Host support for secure credential delivery varies. If it is unavailable, explain that direct payment is unavailable in this connection.

Preserve the order id, revision and completion idempotency key. On a timeout or uncertain result, use `get_billing_order` on the original order; never create a replacement payment or change credentials to work around uncertainty. `requires_action` needs secure payment verification and preserves the order. `processing` means the payment is unresolved. `paid_pending_fulfillment` means payment settled but the credit grant is not confirmed. Only `fulfilled` confirms the purchased credits are available. Resume the original video task after fulfillment without buying another pack.

`cancel_billing_order` cancels an unpaid order; a paid result wins a cancellation race. Cancellation does not refund a settled purchase. `request_billing_refund` is a sensitive, support-reviewed request. Requested is neither approved nor refunded, and credits are not automatically reversed. Refund failure does not turn a paid order into an unpaid order. Share the paid receipt and support route when available.
