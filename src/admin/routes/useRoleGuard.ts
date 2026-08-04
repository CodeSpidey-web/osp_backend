import { useEffect, useState } from "react"

export function useRoleGuard() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    fetch("/admin/client-dashboard/me", { credentials: "include" })
      .then((r) => {
        if (!r.ok) {
          throw new Error(`HTTP error! status: ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        setEmail(data.email)
        const isAuth = !!(data.email && data.email.startsWith("admin@"))
        setAuthorized(isAuth)
        applySidebarRules(data.email)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Error in role guard:", err)
        setLoading(false)
      })
  }, [])

  return { email, loading, authorized }
}

let menuObserver: MutationObserver | null = null

export function applySidebarRules(userEmail: string | null) {
  if (!userEmail) return

  const isClient = userEmail.startsWith("admin@")
  const styleId = "medusa-role-sidebar-style"
  let styleEl = document.getElementById(styleId) as HTMLStyleElement

  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = styleId
    document.head.appendChild(styleEl)
  }

  if (isClient) {
    // 100% CSS-only layout ordering and item hiding logic.
    // Restored the clean padding-left tab space for all main sidebar navigation links.
    styleEl.innerHTML = `
      /* Hide native developer link list-items and their container blocks completely */
      li:has(a[href="/app/orders"]),
      div:has(> a[href="/app/orders"]),
      li:has(a[href="/app/promotions"]),
      div:has(> a[href="/app/promotions"]),
      li:has(a[href="/app/price-lists"]),
      div:has(> a[href="/app/price-lists"]),
      li:has(a[href="/app/inventory"]),
      div:has(> a[href="/app/inventory"]),
      li:has(a[href="/app/settings"]),
      div:has(> a[href="/app/settings"]),
      li:has(a[href*="/reservations"]),
      div:has(> a[href*="/reservations"]),
      li:has(a[href*="/reservation"]),
      div:has(> a[href*="/reservation"]),
      li:has(a[href*="collections"]),
      div:has(> a[href*="collections"]),
      li:has(a[href*="options"]),
      div:has(> a[href*="options"]) {
        display: none !important;
      }

      /* Hide direct documentation links */
      a[href*="docs.medusajs.com"] {
        display: none !important;
      }
      
      /* Make sure custom client links are visible */
      a[href="/app/dashboard"],
      a[href="/app/inventory-management"],
      a[href="/app/order-management"],
      a[href="/app/product-reviews"],
      a[href="/app/website-settings"] {
        display: flex !important;
      }

      /* Turn sidebar/mobile drawer navigation lists into flex columns to enable ordering */
      nav, 
      [role="navigation"],
      [role="dialog"] {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
      }

      /* Flatten ONLY the direct child sections of nav/navigation. This keeps nested dropdowns and footers 100% native and intact */
      nav > section,
      nav > div,
      nav > ul,
      [role="navigation"] > section,
      [role="navigation"] > div,
      [role="navigation"] > ul {
        display: contents !important;
      }

      /* Clear any default padding-left/margin-left on wrapper containers for custom extension links */
      :is(aside, nav, [role="navigation"], [role="dialog"]) div:has(> a[href^="/app/"]) {
        padding-left: 0 !important;
        margin-left: 0 !important;
      }

      /* Set a uniform, pixel-perfect left tab space for all main tabs (links and buttons) in the sidebar */
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div) > :is(a, button) {
        padding-left: 20px !important;
      }

      /* Set a perfect tab space for nested sub-links to show indentation clearly */
      :is(aside, nav, [role="navigation"], [role="dialog"]) li li :is(a, button) {
        padding-left: 36px !important;
      }

      /* Apply strict order layout to the link list-item wrappers directly */
      li:has(a[href="/app/dashboard"]),
      div:has(> a[href="/app/dashboard"]) {
        order: 1 !important;
      }

      /* Products and all its sub-links share order 2 */
      li:has(a[href="/app/products"]),
      div:has(> a[href="/app/products"]) {
        order: 2 !important;
      }

      /* Maintain dropdown list order group to align with Products tab, and set flex column to enable sub-link ordering */
      ul:has(a[href*="collections"]),
      ul:has(a[href*="categories"]),
      ul:has(a[href*="options"]) {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
        order: 2 !important;
      }

      /* Reorder sub-links inside the Products dropdown: Products, Categories, Options, Collections */
      ul:has(a[href*="collections"]) li:has(a[href="/app/products"]) {
        order: 1 !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href*="categories"]) {
        order: 2 !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href*="options"]) {
        order: 3 !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href*="collections"]) {
        order: 4 !important;
      }

      li:has(a[href="/app/order-management"]),
      div:has(> a[href="/app/order-management"]) {
        order: 3 !important;
      }

      li:has(a[href="/app/inventory-management"]),
      div:has(> a[href="/app/inventory-management"]) {
        order: 4 !important;
      }

      li:has(a[href="/app/customers"]),
      div:has(> a[href="/app/customers"]) {
        order: 5 !important;
      }

      li:has(a[href="/app/product-reviews"]),
      div:has(> a[href="/app/product-reviews"]) {
        order: 6 !important;
      }

      li:has(a[href="/app/website-settings"]),
      div:has(> a[href="/app/website-settings"]) {
        order: 7 !important;
      }

      /* On mobile and tablet screens, disable sticky columns on all scrollable tables globally.
         This stops the first column from staying locked on screen and taking up full screen space. */
      @media (max-width: 1024px) {
        .overflow-x-auto th:first-child,
        .overflow-x-auto td:first-child {
          position: static !important;
          left: auto !important;
        }
      }
    `

    // Clean menu items immediately
    cleanDropdownMenuItems()

    // Observe document.body to instantly hide popover items when the dropdown popup renders
    if (!menuObserver) {
      menuObserver = new MutationObserver(() => {
        cleanDropdownMenuItems()
      })
      menuObserver.observe(document.body, { childList: true, subtree: true })
    }
  } else {
    // Hide custom client links for developer
    styleEl.innerHTML = `
      a[href="/app/dashboard"],
      a[href="/app/inventory-management"],
      a[href="/app/order-management"],
      a[href="/app/product-reviews"],
      a[href="/app/website-settings"] {
        display: none !important;
      }

      /* Clear any default padding-left/margin-left on wrapper containers for custom extension links */
      :is(aside, nav, [role="navigation"], [role="dialog"]) div:has(> a[href^="/app/"]) {
        padding-left: 0 !important;
        margin-left: 0 !important;
      }

      /* Set a uniform, pixel-perfect left tab space for all main tabs (links and buttons) in the sidebar */
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div) > :is(a, button) {
        padding-left: 20px !important;
      }

      /* Set a perfect tab space for nested sub-links to show indentation clearly */
      :is(aside, nav, [role="navigation"], [role="dialog"]) li li :is(a, button) {
        padding-left: 36px !important;
      }

      /* Reorder sub-links inside the Products dropdown: Products, Categories, Options, Collections */
      ul:has(a[href*="collections"]) {
        display: flex !important;
        flex-direction: column !important;
        gap: 2px !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href="/app/products"]) {
        order: 1 !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href*="categories"]) {
        order: 2 !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href*="options"]) {
        order: 3 !important;
      }
      ul:has(a[href*="collections"]) li:has(a[href*="collections"]) {
        order: 4 !important;
      }
    `
  }
}

function cleanDropdownMenuItems() {
  // Select both Radix popup menu items and trigger buttons
  const items = document.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button')
  items.forEach((item) => {
    const text = item.textContent?.trim().toLowerCase()
    if (
      text === "changelog" || 
      text === "shortcuts" || 
      text === "keyboard shortcuts" || 
      text === "documentation"
    ) {
      (item as HTMLElement).style.setProperty("display", "none", "important")
    }
  })
}
