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
      /* Hide native developer links and their direct sidebar wrappers completely */
      aside a[href="/app/orders"],
      aside a[href="/app/products"],
      aside a[href="/app/products/"],
      aside a[href="/app/categories"],
      aside a[href="/app/promotions"],
      aside a[href="/app/price-lists"],
      aside a[href="/app/inventory"],
      aside a[href="/app/customer-groups"],
      aside a[href="/app/settings"],
      aside a[href*="/reservations"],
      aside a[href*="/reservation"],
      aside a[href*="collections"],
      aside a[href*="options"],
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/orders"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/products"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/categories"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/promotions"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/price-lists"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/inventory"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/customer-groups"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/settings"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href*="/reservations"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href*="/reservation"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href*="collections"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href*="options"]) {
        display: none !important;
      }

      /* Hide direct documentation links */
      a[href*="docs.medusajs.com"] {
        display: none !important;
      }

      /* Hide top-bar layout customize button */
      button[aria-label*="Customize"],
      button[aria-label*="customize"],
      button[title*="Customize"],
      button[title*="customize"] {
        display: none !important;
      }

      /* Hide the entire sub-menu container under Customers to remove the empty dropdown wrapper space */
      :is(aside, nav, [role="navigation"], [role="dialog"]) ul:has(a[href*="customer-groups"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) div:has(> a[href*="customer-groups"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) ul:has(a[href="/app/customer-groups"]) {
        display: none !important;
      }
      
      /* Make sure custom client links are visible */
      a[href="/app/dashboard"],
      a[href="/app/products-simple"],
      a[href="/app/categories-manager"],
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

      /* Products-simple custom link order 2 */
      li:has(a[href="/app/products-simple"]),
      div:has(> a[href="/app/products-simple"]) {
        order: 2 !important;
      }

      /* Hide the native Products entry and its Collections/Options sub-menu wrappers (sidebar scoped, direct-child only) */
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href="/app/products"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href*="collections"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) :is(li, div):has(> a[href*="options"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) ul:has(a[href*="collections"]),
      :is(aside, nav, [role="navigation"], [role="dialog"]) ul:has(a[href*="options"]) {
        display: none !important;
      }

      /* Elevate categories custom route to order 3 in the sidebar */
      li:has(a[href="/app/categories-manager"]),
      div:has(> a[href="/app/categories-manager"]) {
        order: 3 !important;
      }

      li:has(a[href="/app/order-management"]),
      div:has(> a[href="/app/order-management"]) {
        order: 4 !important;
      }

      li:has(a[href="/app/inventory-management"]),
      div:has(> a[href="/app/inventory-management"]) {
        order: 5 !important;
      }

      li:has(a[href="/app/customers"]),
      div:has(> a[href="/app/customers"]) {
        order: 6 !important;
      }

      li:has(a[href="/app/product-reviews"]),
      div:has(> a[href="/app/product-reviews"]) {
        order: 7 !important;
      }

      li:has(a[href="/app/website-settings"]),
      div:has(> a[href="/app/website-settings"]) {
        order: 8 !important;
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
    cleanSidebarCustomersItem()
    cleanNativeProductsMenu()

    // Observe document.body to instantly hide popover items when the dropdown popup renders
    if (!menuObserver) {
      menuObserver = new MutationObserver(() => {
        cleanDropdownMenuItems()
        cleanSidebarCustomersItem()
        cleanNativeProductsMenu()
      })
      menuObserver.observe(document.body, { childList: true, subtree: true })
    }
  } else {
    // Hide custom client links for developer
    styleEl.innerHTML = `
      a[href="/app/dashboard"],
      a[href="/app/categories-manager"],
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
      text === "documentation" ||
      text === "customize"
    ) {
      (item as HTMLElement).style.setProperty("display", "none", "important")
    }
  })
}

function cleanSidebarCustomersItem() {
  const customersLinks = document.querySelectorAll(
    'aside a[href="/app/customers"], nav a[href="/app/customers"], [role="navigation"] a[href="/app/customers"]'
  )

  customersLinks.forEach((link) => {
    let itemEl = link.parentElement
    if (!itemEl) return

    // Hide any sibling collapsible sub-menus/ul wrappers
    let sibling = itemEl.nextElementSibling
    if (sibling && (sibling.tagName === "UL" || sibling.tagName === "DIV" || sibling.outerHTML.includes("groups"))) {
      (sibling as HTMLElement).style.setProperty("display", "none", "important")
    }

    // Hide chevron SVG icons inside/next to the link
    const svgs = itemEl.querySelectorAll("svg")
    svgs.forEach((svg) => {
      const html = svg.outerHTML.toLowerCase()
      const paths = svg.querySelectorAll("path")
      let isChevron = false
      paths.forEach((path) => {
        const d = path.getAttribute("d") || ""
        if (d.includes("m6") || d.includes("M6") || d.includes("m9") || d.includes("M9") || d.includes("m19") || d.includes("M19")) {
          isChevron = true
        }
      })
      if (
        svg.classList.contains("chevron") || 
        html.includes("chevron") ||
        html.includes("arrow") ||
        isChevron
      ) {
        (svg as unknown as HTMLElement).style.setProperty("display", "none", "important")
      }
    })
  })
}

function cleanNativeProductsMenu() {
  if (typeof document === "undefined") return
  const nativeLinks = document.querySelectorAll(
    'aside a[href*="collections"], nav a[href*="collections"], [role="navigation"] a[href*="collections"], aside a[href*="options"], nav a[href*="options"], [role="navigation"] a[href*="options"], aside a[href="/app/products"], nav a[href="/app/products"], [role="navigation"] a[href="/app/products"]'
  )
  nativeLinks.forEach((link) => {
    (link as HTMLElement).style.setProperty("display", "none", "important")

    // Collapse the hidden item's wrapper chain (direct link wrapper + nav item root)
    // so no phantom empty line with its flex gap is left in the sidebar.
    let el = link.parentElement
    let hops = 0
    while (el && el !== document.body && hops < 2) {
      const tag = el.tagName
      if (tag === "NAV" || tag === "ASIDE" || el.getAttribute?.("role") === "navigation" || el.getAttribute?.("role") === "dialog") break
      if (tag === "DIV" || tag === "LI" || tag === "UL") {
        el.style.setProperty("display", "none", "important")
      }
      el = el.parentElement
      hops++
    }
  })
}

export function forceLeftSidebarDirection() {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = 'ltr'
  }
}
