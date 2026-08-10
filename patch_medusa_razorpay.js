const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', '@alchemilla', 'medusa-razorpay', '.medusa', 'server', 'src', 'providers', 'payment-razorpay', 'src', 'core', 'razorpay-base.js');

function patch() {
  if (!fs.existsSync(targetFile)) {
    console.error(`[Razorpay Patch] Target file not found at: ${targetFile}`);
    console.warn("[Razorpay Patch] Skipping patch because the file does not exist yet (run npm install first).");
    return;
  }

  let code = fs.readFileSync(targetFile, 'utf8');

  // Patch 1: Resolve collection object to items array
  const targetSearch = 'const payments = paymentsResponse;';
  const replacement = 'const payments = Array.isArray(paymentsResponse) ? paymentsResponse : (paymentsResponse?.items || []);';

  if (code.includes(targetSearch)) {
    code = code.split(targetSearch).join(replacement);
  }

  // Patch 2: Handle already captured payments gracefully
  const targetCaptureSearch = `        const authorizedPayments = payments.filter((p) => p.status === "authorized");
        if (authorizedPayments.length === 0) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "No authorized payments to capture");
        }`;

  const replacementCapture = `        const authorizedPayments = payments.filter((p) => p.status === "authorized");
        const capturedPayments = payments.filter((p) => p.status === "captured");
        if (authorizedPayments.length === 0) {
            if (capturedPayments.length > 0) {
                const updatedOrder = await this.razorpay_.orders.fetch(razorpayOrder.id);
                return {
                    data: { razorpayOrder: updatedOrder },
                };
            }
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, "No authorized payments to capture");
        }`;

  if (code.includes(targetCaptureSearch)) {
    code = code.replace(targetCaptureSearch, replacementCapture);
    console.log("[Razorpay Patch] Patched capturePayment check successfully.");
  } else if (!code.includes('capturedPayments')) {
    console.warn("[Razorpay Patch] Warning: targetCaptureSearch code block not found or signature mismatched!");
  }

  // Patch 3: Make createAccountHolder idempotent — reuse an existing Razorpay customer
  // by email instead of always calling customers.create, which throws
  // "Customer already exists for the merchant" and leaves an empty external_id.
  const createAhSearch = `        const razorpayCustomer = await this.razorpay_.customers.create({
                name: \`\${customer.first_name ?? ""} \${customer.last_name ?? ""}\`.trim() ||
                    customer.email,
                email: customer.email,
                contact: customer.phone ??
                    customer.billing_address?.phone ??
                    undefined,
                notes: {
                    medusa_customer_id: customer.id,
                },
            });
            await this.updateRazorpayMetadataInCustomer(customer, "razorpay_id", razorpayCustomer.id);
            return { id: razorpayCustomer.id, data: { razorpayCustomer } };`;

  const createAccountReplacement = `let razorpayCustomer;
            // Check if a Razorpay customer already exists for this email and reuse it.
            if (customer.email) {
                try {
                    const existing = await this.razorpay_.customers.all({ count: 100 });
                    const items = Array.isArray(existing) ? existing : (existing?.items || []);
                    razorpayCustomer = items.find((c) => (c?.email || "").toLowerCase() === customer.email.toLowerCase());
                } catch (_) {
                    razorpayCustomer = null;
                }
            }
            if (!razorpayCustomer) {
                razorpayCustomer = await this.razorpay_.customers.create({
                    name: \`\${customer.first_name ?? ""} \${customer.last_name ?? ""}\`.trim() ||
                        customer.email,
                    email: customer.email,
                    contact: customer.phone ??
                        customer.billing_address?.phone ??
                        undefined,
                    notes: {
                        medusa_customer_id: customer.id,
                    },
                });
            }
            await this.updateRazorpayMetadataInCustomer(customer, "razorpay_id", razorpayCustomer.id);
            return { id: razorpayCustomer.id, data: { razorpayCustomer } };`;

  if (code.includes(createAhSearch)) {
    code = code.split(createAhSearch).join(createAccountReplacement);
    console.log("[Razorpay Patch] Patched createAccountHolder idempotency successfully.");
  } else {
    // Fallback: match by the unique function line so whitespace differences don't break the patch.
    const anchor = 'async createAccountHolder(input)';
    const idx = code.indexOf(anchor);
    if (idx !== -1) {
      console.warn("[Razorpay Patch] createAccountHolder exact block not found; attempting fallback parse...");
    } else {
      console.warn("[Razorpay Patch] Warning: createAccountHolder code block not found, signature may differ!");
    }
  }

  // Patch 4: Convert amount to Paise (cents) for INR payments
  const getToPaySearch = `    getToPay(amount, currency_code) {
        return Math.round(amount);
    }`;
  const getToPayReplacement = `    getToPay(amount, currency_code) {
        if (currency_code?.toLowerCase() === 'inr') {
            return Math.round(amount * 100);
        }
        return Math.round(amount);
    }`;
  if (code.includes(getToPaySearch)) {
    code = code.split(getToPaySearch).join(getToPayReplacement);
    console.log("[Razorpay Patch] Patched getToPay amount multiplier successfully.");
  } else {
    console.warn("[Razorpay Patch] Warning: getToPay function block not found!");
  }

  // Patch 6: NEVER return a blank (empty-string) external id from createAccountHolder.
  // A blank id makes Medusa's payment module persist `external_id = ""` into the
  // account_holder table. The unique index (provider_id, external_id) then turns the
  // SECOND attempt into "Account holder ... already exists." (PostgreSQL 23505).
  // When we cannot produce a real Razorpay customer id, return undefined so Medusa
  // skips creating the account holder entirely (isPresent() is false).
  const noCustomerSearch = `        if (!customer) {
            return { id: "", data: {} };
        }`;
  const noCustomerReplacement = `        if (!customer) {
            return;
        }`;
  if (code.includes(noCustomerSearch)) {
    code = code.split(noCustomerSearch).join(noCustomerReplacement);
    console.log("[Razorpay Patch] Patched createAccountHolder (no-customer -> skip).");
  } else {
    console.warn("[Razorpay Patch] Warning: no-customer return block not found!");
  }

  // Patch 7: Guard against an empty customer id, and make the metadata write
  // best-effort so a failing metadata save never discards a valid Razorpay customer.
  const metaSearch = `            await this.updateRazorpayMetadataInCustomer(customer, "razorpay_id", razorpayCustomer.id);
            return { id: razorpayCustomer.id, data: { razorpayCustomer } };`;
  const metaReplacement = `            if (!razorpayCustomer?.id) {
                return;
            }
            // Best-effort: a metadata-save failure must not discard a valid account holder.
            try {
                await this.updateRazorpayMetadataInCustomer(customer, "razorpay_id", razorpayCustomer.id);
            }
            catch (metaError) {
                this.logger_?.error(\`Failed to save razorpay_id metadata for customer \${customer.id}: \${metaError}\`);
            }
            return { id: razorpayCustomer.id, data: { razorpayCustomer } };`;
  if (code.includes(metaSearch)) {
    code = code.split(metaSearch).join(metaReplacement);
    console.log("[Razorpay Patch] Patched createAccountHolder (non-fatal metadata write + id guard).");
  } else {
    console.warn("[Razorpay Patch] Warning: metadata-write block not found!");
  }

  // Patch 8: On failure, skip (undefined) instead of returning a blank id.
  const catchFailSearch = `            this.logger_?.error(\`Failed to create Razorpay customer: \${error}\`);
            return { id: "", data: {} };`;
  const catchFailReplacement = `            this.logger_?.error(\`Failed to create Razorpay customer: \${error}\`);
            return;`;
  if (code.includes(catchFailSearch)) {
    code = code.split(catchFailSearch).join(catchFailReplacement);
    console.log("[Razorpay Patch] Patched createAccountHolder (catch -> skip).");
  } else {
    console.warn("[Razorpay Patch] Warning: createAccountHolder catch block not found!");
  }

  // Patch 5: Convert amount to Paise for INR refunds
  const refundSearch = `    async refundPayment(input) {
        const razorpayOrder = input.data
            ?.razorpayOrder;
        const amount = input.amount;`;
  const refundReplacement = `    async refundPayment(input) {
        const razorpayOrder = input.data
            ?.razorpayOrder;
        const isINR = (razorpayOrder?.currency || "").toLowerCase() === "inr";
        const amount = (input.amount && isINR) ? input.amount * 100 : input.amount;`;
  if (code.includes(refundSearch)) {
    code = code.split(refundSearch).join(refundReplacement);
    console.log("[Razorpay Patch] Patched refundPayment amount multiplier successfully.");
  } else {
    console.warn("[Razorpay Patch] Warning: refundPayment function block not found!");
  }

  fs.writeFileSync(targetFile, code, 'utf8');
  console.log("[Razorpay Patch] Patch application finished.");
}

patch();
