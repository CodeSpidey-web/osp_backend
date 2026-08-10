import { MedusaContainer } from "@medusajs/framework"
import {
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils"

export default async function clearCustomerData({
  container,
}: {
  container: MedusaContainer
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const db = container.resolve("__pg_connection__") as any

  logger.info("Clearing customer / order / cart / payment data...")

  try {
    // 1. Delete non-admin auth identities (keep admin logins like admin@* and developer@*)
    const authDelete = await db.raw(
      `DELETE FROM auth_verification
         WHERE auth_identity_id IN (
           SELECT id FROM auth_identity
           WHERE app_metadata IS NULL OR app_metadata->>'user_id' IS NULL
         )`
    )
    logger.info(`auth_verification deleted: ${authDelete?.rowCount ?? 0}`)

    const mfa = await db.raw(
      `DELETE FROM auth_mfa_factor
         WHERE auth_identity_id IN (
           SELECT id FROM auth_identity
           WHERE app_metadata IS NULL OR app_metadata->>'user_id' IS NULL
         )`
    )
    logger.info(`auth_mfa_factor deleted: ${mfa?.rowCount ?? 0}`)

    const mfaRecovery = await db.raw(
      `DELETE FROM auth_mfa_recovery_code
         WHERE auth_identity_id IN (
           SELECT id FROM auth_identity
           WHERE app_metadata IS NULL OR app_metadata->>'user_id' IS NULL
         )`
    )
    logger.info(`auth_mfa_recovery_code deleted: ${mfaRecovery?.rowCount ?? 0}`)

    const resetTokens = await db.raw(
      `DELETE FROM auth_password_reset_token
         WHERE auth_identity_id IN (
           SELECT id FROM auth_identity
           WHERE app_metadata IS NULL OR app_metadata->>'user_id' IS NULL
         )`
    )
    logger.info(`auth_password_reset_token deleted: ${resetTokens?.rowCount ?? 0}`)

    const provider = await db.raw(
      `DELETE FROM provider_identity
         WHERE auth_identity_id IN (
           SELECT id FROM auth_identity
           WHERE app_metadata IS NULL OR app_metadata->>'user_id' IS NULL
         )`
    )
    logger.info(`provider_identity deleted: ${provider?.rowCount ?? 0}`)

    const authIdentity = await db.raw(
      `DELETE FROM auth_identity
         WHERE app_metadata IS NULL OR app_metadata->>'user_id' IS NULL`
    )
    logger.info(`auth_identity deleted: ${authIdentity?.rowCount ?? 0}`)
  } catch (e: any) {
    logger.warn(`Auth cleanup warning: ${e.message}`)
  }

  // 2) Truncate all customer-related sales tables (order, cart, fulfilment, payment, returns, reservations)
  const tablesToTruncate = [
    // customer module
    "customer_account_holder",
    "customer_address",
    "customer_group_customer",
    "customer_group",
    "account_holder",
    "customer",
    // cart module
    "cart_line_item_adjustment",
    "cart_line_item_tax_line",
    "cart_line_item",
    "cart_shipping_method_adjustment",
    "cart_shipping_method_tax_line",
    "cart_shipping_method",
    "cart_payment_collection",
    "cart_promotion",
    "cart_address",
    "credit_line",
    "cart",
    // order module
    "order_claim_item_image",
    "order_claim_item",
    "order_claim",
    "order_exchange_item",
    "order_exchange",
    "order_line_item_adjustment",
    "order_line_item_tax_line",
    "order_item",
    "order_line_item",
    "order_shipping_method_adjustment",
    "order_shipping_method_tax_line",
    "order_shipping_method",
    "order_fulfillment",
    "order_change_action",
    "order_change",
    "order_payment_collection",
    "order_promotion",
    "order_credit_line",
    "order_shipping",
    "order_summary",
    "order_transaction",
    "order_cart",
    "order_address",
    "order",
    // fulfilment
    "fulfillment_label",
    "fulfillment_item",
    "fulfillment_address",
    "fulfillment",
    // payment module
    "capture",
    "refund",
    "payment_session",
    "payment_collection_payment_providers",
    "payment",
    "payment_collection",
    // returns
    "return_item",
    "return_fulfillment",
    "return",
    // inventory reservations created by customer carts/orders
    "reservation_item",
  ]

  const stmt = tablesToTruncate.map((t) => `"${t}"`).join(", ")
  await db.raw(`TRUNCATE TABLE ${stmt} CASCADE;`)

  logger.info("Customer / order / cart / payment data cleared perfectly!")
}