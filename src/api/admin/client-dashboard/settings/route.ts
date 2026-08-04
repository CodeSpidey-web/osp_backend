import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { createShippingOptionsWorkflow } from "@medusajs/medusa/core-flows";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const query = req.scope.resolve("query")
  const taxService = req.scope.resolve("tax") as any
  const db = req.scope.resolve("__pg_connection__") as any
  const productModuleService = req.scope.resolve("product") as any

  try {
    // 1. Fetch store info
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "name", "metadata"],
    })
    const store = stores[0]

    // 2. Fetch tax region and rates for India (country code "in")
    let taxRegions = await taxService.listTaxRegions({ country_code: "in" }, { relations: ["tax_rates.rules"] })
    let taxRegion = taxRegions[0]

    if (!taxRegion) {
      // If it doesn't exist, create it dynamically
      const newRegions = await taxService.createTaxRegions([{ country_code: "in", provider_id: "tp_system" }])
      taxRegion = newRegions[0]
      taxRegion.tax_rates = []
    }

    // 3. Find default tax rate
    const defaultRateObj = taxRegion.tax_rates?.find((r: any) => r.is_default)
    const taxRate = defaultRateObj ? defaultRateObj.rate : 18

    // 4. Fetch price preference (tax inclusive setting) for INR and regions
    const isTaxInclusiveRes = await db.raw(
      "SELECT is_tax_inclusive FROM price_preference WHERE attribute = 'currency_code' AND value = 'inr'"
    )
    const isTaxInclusive = isTaxInclusiveRes.rows[0]?.is_tax_inclusive ?? false

    // 5. Gather custom tax rate overrides and their product titles
    const overrides = taxRegion.tax_rates
      ?.filter((r: any) => !r.is_default && r.rules?.some((rule: any) => rule.reference === "product"))
      ?.map((r: any) => {
        const rule = r.rules?.find((rule: any) => rule.reference === "product")
        return {
          id: r.id,
          rate: r.rate,
          code: r.code,
          name: r.name,
          product_id: rule?.reference_id || null,
          product_title: ""
        }
      }) || []

    const productIds = overrides.map((o: any) => o.product_id).filter(Boolean)
    if (productIds.length > 0) {
      const products = await productModuleService.listProducts({ id: productIds }, { select: ["id", "title"] })
      const productMap = new Map(products.map((p: any) => [p.id, p.title]))
      for (const o of overrides) {
        o.product_title = productMap.get(o.product_id) || "Unknown Product"
      }
    }

    res.json({
      store_id: store.id,
      name: store.name,
      logo_url: store.metadata?.logo_url || "",
      phone: store.metadata?.phone || "",
      email: store.metadata?.email || "",
      tax_rate: taxRate,
      is_tax_inclusive: isTaxInclusive,
      tax_overrides: overrides,
      flat_shipping_rate: store.metadata?.flat_shipping_rate !== undefined ? Number(store.metadata?.flat_shipping_rate) : 70,
      shipping_gst: store.metadata?.shipping_gst !== undefined ? Number(store.metadata?.shipping_gst) : 18,
      free_shipping_threshold: store.metadata?.free_shipping_threshold !== undefined ? Number(store.metadata?.free_shipping_threshold) : 999
    })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred retrieving settings" })
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const { 
    logo_url, 
    phone, 
    email, 
    tax_rate, 
    is_tax_inclusive, 
    tax_overrides,
    flat_shipping_rate,
    shipping_gst,
    free_shipping_threshold
  } = req.body as {
    logo_url: string
    phone: string
    email: string
    tax_rate: number
    is_tax_inclusive: boolean
    tax_overrides: Array<{
      rate: number
      code?: string
      name?: string
      product_id: string
    }>
    flat_shipping_rate: number
    shipping_gst: number
    free_shipping_threshold: number
  }

  const query = req.scope.resolve("query")
  const storeModuleService = req.scope.resolve("store") as any
  const taxService = req.scope.resolve("tax") as any
  const db = req.scope.resolve("__pg_connection__") as any

  try {
    // 1. Update store metadata
    const { data: stores } = await query.graph({
      entity: "store",
      fields: ["id", "metadata"],
    })
    const store = stores[0]

    const updatedMetadata = {
      ...(store.metadata || {}),
      logo_url,
      phone,
      email,
      flat_shipping_rate: Number(flat_shipping_rate),
      shipping_gst: Number(shipping_gst),
      free_shipping_threshold: Number(free_shipping_threshold)
    }

    await storeModuleService.updateStores({
      id: store.id,
      metadata: updatedMetadata,
    })

    // 2. Fetch/update India tax region & default tax rate
    let taxRegions = await taxService.listTaxRegions({ country_code: "in" }, { relations: ["tax_rates.rules"] })
    let taxRegion = taxRegions[0]

    if (!taxRegion) {
      const newRegions = await taxService.createTaxRegions([{ country_code: "in", provider_id: "tp_system" }])
      taxRegion = newRegions[0]
      taxRegion.tax_rates = []
    }

    const defaultRateObj = taxRegion.tax_rates?.find((r: any) => r.is_default)
    const targetTaxRateVal = isNaN(Number(tax_rate)) ? 18 : Number(tax_rate)

    if (defaultRateObj) {
      await taxService.updateTaxRates({ id: defaultRateObj.id, rate: targetTaxRateVal })
    } else {
      await taxService.createTaxRates({
        tax_region_id: taxRegion.id,
        rate: targetTaxRateVal,
        code: "GST",
        name: "GST",
        is_default: true
      })
    }

    // 3. Update price_preference values (tax inclusivity) in DB
    const taxInclusiveBool = !!is_tax_inclusive
    await db.raw(
      "UPDATE price_preference SET is_tax_inclusive = ? WHERE attribute = 'currency_code' AND value = 'inr'",
      [taxInclusiveBool]
    )
    await db.raw(
      "UPDATE price_preference SET is_tax_inclusive = ? WHERE attribute = 'region_id'",
      [taxInclusiveBool]
    )

    // 4. Update the standard shipping option's database price
    const shippingOptionName = "Standard Shipping"
    const optionRes = await db.raw(
      "SELECT id FROM shipping_option WHERE name = ?",
      [shippingOptionName]
    )
    const standardOptionId = optionRes.rows[0]?.id
    if (standardOptionId) {
      const priceSetRes = await db.raw(
        "SELECT price_set_id FROM shipping_option_price_set WHERE shipping_option_id = ?",
        [standardOptionId]
      )
      const priceSetId = priceSetRes.rows[0]?.price_set_id
      if (priceSetId) {
        await db.raw(
          "UPDATE price SET amount = ? WHERE price_set_id = ? AND currency_code = 'inr'",
          [Number(flat_shipping_rate) * 100, priceSetId]
        )
      }
    }

    // 5. Ensure "Free Shipping" option exists
    const freeOptionRes = await db.raw("SELECT id FROM shipping_option WHERE name = 'Free Shipping'")
    if (freeOptionRes.rows.length === 0 && standardOptionId) {
      const standardOptionDetails = await db.raw(
        "SELECT service_zone_id, shipping_profile_id, provider_id FROM shipping_option WHERE id = ?",
        [standardOptionId]
      )
      const eo = standardOptionDetails.rows[0]
      if (eo) {
        await createShippingOptionsWorkflow(req.scope).run({
          input: [{
            name: "Free Shipping",
            price_type: "flat",
            provider_id: eo.provider_id || "manual_manual",
            service_zone_id: eo.service_zone_id,
            shipping_profile_id: eo.shipping_profile_id,
            type: { label: "Free", description: "Free shipping.", code: "free" },
            prices: [{ currency_code: "inr", amount: 0 }],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" }
            ]
          }]
        })
      }
    }

    // 6. Update the Shipping Option GST tax override rate
    if (standardOptionId) {
      const targetShippingGst = isNaN(Number(shipping_gst)) ? 18 : Number(shipping_gst)
      const existingShippingRateRes = await db.raw(`
        SELECT tr.id
        FROM tax_rate tr
        JOIN tax_rate_rule trr ON trr.tax_rate_id = tr.id
        WHERE trr.reference = 'shipping_option' AND trr.reference_id = ? AND tr.tax_region_id = ?
      `, [standardOptionId, taxRegion.id])

      const existingShippingRateId = existingShippingRateRes.rows[0]?.id

      if (existingShippingRateId) {
        await taxService.updateTaxRates({ id: existingShippingRateId, rate: targetShippingGst })
      } else {
        await taxService.createTaxRates({
          tax_region_id: taxRegion.id,
          rate: targetShippingGst,
          code: "GST_SHIPPING",
          name: "Shipping GST",
          is_default: false,
          rules: [
            {
              reference: "shipping_option",
              reference_id: standardOptionId
            }
          ]
        })
      }
    }

    // 7. Delete existing custom product tax rates and recreate the new overrides list
    const customRates = taxRegion.tax_rates?.filter(
      (r: any) => !r.is_default && r.rules?.some((rule: any) => rule.reference === "product")
    ) || []
    if (customRates.length > 0) {
      await taxService.deleteTaxRates(customRates.map((r: any) => r.id))
    }

    if (Array.isArray(tax_overrides)) {
      for (const override of tax_overrides) {
        const rateVal = Number(override.rate)
        if (override.product_id && !isNaN(rateVal)) {
          const codeVal = override.code || `GST${rateVal}`
          const nameVal = override.name || `GST ${rateVal}% Override`
          await taxService.createTaxRates({
            tax_region_id: taxRegion.id,
            rate: rateVal,
            code: codeVal,
            name: nameVal,
            is_default: false,
            rules: [
              {
                reference: "product",
                reference_id: override.product_id
              }
            ]
          })
        }
      }
    }

    res.json({ success: true, metadata: updatedMetadata })
  } catch (error: any) {
    res.status(500).json({ message: error.message || "An error occurred saving settings" })
  }
}
