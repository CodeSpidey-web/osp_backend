const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'node_modules', '@medusajs', 'payment', 'dist', 'services', 'payment-module.js');

function patch() {
  if (!fs.existsSync(targetFile)) {
    console.error(`[Payment Module Patch] Target file not found at: ${targetFile}`);
    console.warn("[Payment Module Patch] Skipping patch because the file does not exist yet (run npm install first).");
    return;
  }

  let code = fs.readFileSync(targetFile, 'utf8');

  // Only persist an account_holder row when the provider actually returned a
  // non-blank external id. Providers (e.g. Razorpay) that cannot create a real
  // external customer return an empty id or undefined; persisting blank ids
  // fills the unique index (provider_id, external_id) with '' and every later
  // attempt blows up with "Account holder ... already exists." (23505).
  const search = `        // This can be empty when either the method is not supported or an account holder wasn't created
        if ((0, utils_1.isPresent)(providerAccountHolder)) {`;
  const replacement = `        // This can be empty when either the method is not supported or an account holder wasn't created
        if ((0, utils_1.isPresent)(providerAccountHolder) && !!providerAccountHolder.id) {`;

  if (code.includes(search)) {
    code = code.split(search).join(replacement);
    console.log("[Payment Module Patch] Patched createAccountHolder to skip blank external ids.");
  } else if (code.includes('account_holder wasn')) {
    const anchorSearch = `if ((0, utils_1.isPresent)(providerAccountHolder)) {`;
    if (code.includes(anchorSearch)) {
      code = code.split(anchorSearch).join(`if ((0, utils_1.isPresent)(providerAccountHolder) && !!providerAccountHolder.id) {`);
      console.log("[Payment Module Patch] Patched createAccountHolder (fallback match).");
    } else {
      console.warn("[Payment Module Patch] Warning: providerAccountHolder guard not found!");
    }
  } else {
    console.warn("[Payment Module Patch] Warning: createAccountHolder block not found, signature may differ!");
  }

  fs.writeFileSync(targetFile, code, 'utf8');
  console.log("[Payment Module Patch] Patch application finished.");
}

patch();