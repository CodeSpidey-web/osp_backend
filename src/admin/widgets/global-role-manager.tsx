import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { applySidebarRules, forceLeftSidebarDirection } from "../utils/useRoleGuard"

const GlobalRoleManagerWidget = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/app/orders' || path === '/app/orders/' || path === '/app' || path === '/app/') {
        window.location.replace('/app/dashboard');
      }
    }
    forceLeftSidebarDirection();
  }, []);

  useEffect(() => {
    fetch("/admin/client-dashboard/me", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch profile")
        return r.json()
      })
      .then((data) => {
        if (data.email) {
          applySidebarRules(data.email)
        }
      })
      .catch((err) => console.error("Error in GlobalRoleManagerWidget:", err))
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Inject CSS rule for hiding elements permanently
    const styleId = 'simplify-product-form-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        [data-hide-product-field="true"] {
          display: none !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    /**
     * Fields & sections we want on the product create/edit page:
     *  - Product name (title)
     *  - Category (the category select)
     *  - Media (multiple images)
     *  - Price + SKU (kept via the Variants/Pricing grid)
     *  - Description
     *
     * Everything else is considered unwanted and hidden.
     *
     * IMPORTANT: The Variants/Pricing area (the grid/data-table where the
     * "Price+" button, price cells and SKU columns live) must NEVER be hidden.
     * `isProtectedRegion` guards every matched element so the hide rules can
     * only ever touch plain form fields, never the variants/pricing grids,
     * tables, price cells or SKU columns.
     */
    const isProductPage = () => {
      if (typeof window === 'undefined') return false;
      const path = window.location.pathname;
      return path.startsWith('/app/products') || path === '/app/products';
    }

    // ------------------------- KEEP list / protection -------------------------
    // Roles that wrap the Variants/Pricing data grids, tables and their cells.
    const PROTECTED_ROLES = new Set([
      'application',
      'grid',
      'gridcell',
      'table',
      'row',
      'rowgroup',
      'rowheader',
      'columnheader',
      'treegrid',
    ]);
    // Raw table elements (used by the detail page Variants table).
    const PROTECTED_TAGS = new Set(['TABLE', 'THEAD', 'TBODY', 'TFOOT']);
    // Anchor ids of the keep-visible regions on the product forms.
    const isKeepId = (id: string) =>
      /^(variant|pricing|price|media|category|sku)/.test(
        (id || '').toLowerCase()
      );
    // Section headings whose contents are "keep" territory.
    const KEEP_HEADINGS = [
      'variants',
      'pricing',
      'price',
      'media',
      'categories',
    ];

    // Returns true when el (or any of its ancestors) lives inside a
    // Variants/Pricing, price, SKU, media or category region. Elements that do
    // are never hidden, no matter which hide rule would otherwise match.
    const isProtectedRegion = (el: any) => {
      let node: any = el;
      let depth = 0;
      while (node && node !== document.body && depth < 10) {
        const role = node.getAttribute ? node.getAttribute('role') : null;
        if (role && PROTECTED_ROLES.has(role)) return true;

        if (node.id && isKeepId(node.id)) return true;

        if (node.tagName && PROTECTED_TAGS.has(node.tagName)) return true;

        if (
          (node.tagName === 'H2' || role === 'heading') &&
          node.textContent
        ) {
          const headingText = (node.textContent || '')
            .trim()
            .toLowerCase();
          for (const k of KEEP_HEADINGS) {
            if (headingText.indexOf(k) === 0) return true;
          }
        }

        node = node.parentElement;
        depth++;
      }
      return false;
    };

    const simplifyForm = () => {
      const containers: any[] = [];

      if (isProductPage()) {
        const mainEl = document.querySelector('main') || document.body;
        if (mainEl) containers.push(mainEl);
      }

      const activeDialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      activeDialogs.forEach(dialog => {
        const text = dialog.textContent || '';
        if (text.includes('Product') || text.includes('product')) {
          containers.push(dialog);
        }
      });

      containers.forEach(containerEl => {
        const elements = containerEl.querySelectorAll('h1, h2, h3, h4, legend, span, p, button, a');
        elements.forEach((el: any) => {
          // Never hide the Variants/Pricing/Price/SKU/Media/Category areas.
          if (isProtectedRegion(el)) return;

          const elText = (el.textContent || '').trim().toLowerCase();
          if (!elText) return;

          // Helper to hide the container of a label/field
          const hideFieldContainer = (targetEl: any) => {
            let parent = targetEl.parentElement;
            let found = false;
            let depth = 0;
            while (parent && parent !== containerEl && depth < 5) {
              if (
                parent.querySelector('input') ||
                parent.querySelector('textarea') ||
                parent.querySelector('select') ||
                parent.querySelector('button') ||
                parent.querySelector('[role="combobox"]') ||
                parent.classList.contains('flex-col') ||
                parent.classList.contains('grid')
              ) {
                parent.setAttribute('data-hide-product-field', 'true');
                found = true;
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
            if (!found && targetEl.parentElement) {
              targetEl.parentElement.setAttribute('data-hide-product-field', 'true');
            }
          };

          // Helper to hide a section card (used on the edit/detail page side panels)
          const hideSectionCard = (targetEl: any) => {
            let parent = targetEl.parentElement;
            while (parent && parent !== containerEl) {
              const cls = parent.className || "";
              const isSection =
                cls.includes('divide-y') ||
                cls.includes('rounded-lg') ||
                cls.includes('rounded-xl') ||
                cls.includes('p-0') ||
                parent.tagName === 'SECTION';
              if (isSection) {
                parent.setAttribute('data-hide-product-field', 'true');
                return;
              }
              parent = parent.parentElement;
            }
            hideFieldContainer(targetEl);
          };

          // 1. Subtitle
          if (elText === 'subtitle' || (elText.includes('subtitle') && elText.includes('optional'))) {
            hideFieldContainer(el);
          }

          // 2. Handle
          if (elText === 'handle' || (elText.includes('handle') && elText.includes('optional'))) {
            hideFieldContainer(el);
          }

          // 3. Material
          if (elText === 'material' || (elText.includes('material') && elText.includes('optional'))) {
            hideFieldContainer(el);
          }

          // 4. Discountable
          if (elText.includes('discountable') || elText.includes('discounts will not be applied')) {
            hideFieldContainer(el);
          }

          // 5. Type
          if (elText.includes('type') && (elText.includes('optional') || elText === 'type')) {
            hideFieldContainer(el);
          }

          // 6. Collection
          if (elText.includes('collection') && (elText.includes('optional') || elText === 'collection')) {
            hideFieldContainer(el);
          }

          // 7. Tags
          if (elText === 'tags' || (elText.includes('tags') && elText.includes('optional'))) {
            hideFieldContainer(el);
          }

          // 8. Price lists section
          if (elText === 'price list' || elText === 'price lists' || (elText.includes('price list') && elText.includes('.'))) {
            hideFieldContainer(el);
          }

          // 9. Customs & Shipping (HS Code, MID Code, Country of Origin)
          if (
            elText === 'hs code' ||
            elText === 'mid code' ||
            elText.includes('country of origin') ||
            elText.includes('harmonized system code')
          ) {
            hideFieldContainer(el);
          }

          // 9b. Customs/Dimensions sections (card-level headings)
          if (elText === 'customs' || elText === 'dimensions') {
            hideSectionCard(el);
          }

          // 10. Attribute field-level labels (dimensions used as individual fields)
          if (
            elText === 'width' ||
            elText === 'height' ||
            elText === 'length' ||
            elText === 'weight' ||
            elText === 'mid code'
          ) {
            hideFieldContainer(el);
          }

          // 10b. Attributes section heading (right column card)
          if (elText === 'attributes') {
            hideSectionCard(el);
          }

          // 11. Sales Channels / Shipping Profile - hide the section card entirely
          if (
            elText === 'sales channels' ||
            elText === 'sales_channel' ||
            elText.includes('available in sales channels') ||
            elText.includes('sales channels') ||
            elText === 'shipping profile'
          ) {
            hideSectionCard(el);
          }

          // 12. Metadata and JSON debug panels
          if (
            elText === 'metadata' ||
            elText === 'metadata (optional)' ||
            elText === 'json view' ||
            elText.includes('json') ||
            elText === 'required permissions'
          ) {
            hideSectionCard(el);
          }

          // All other checks only apply to disabled content
        });
      });
    };

    const fixImages = () => {
      const images = document.querySelectorAll('img[src^="/images/"], img[src*="/images/"]');
      images.forEach((img: any) => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('/images/')) {
          img.setAttribute('src', `http://localhost:3000${src}`);
        } else if (src.includes('/images/') && !src.startsWith('http')) {
          const idx = src.indexOf('/images/');
          img.setAttribute('src', `http://localhost:3000${src.substring(idx)}`);
        }
      });
    };

    // Run initially
    simplifyForm();
    fixImages();

    // Set up MutationObserver to detect drawer mounting and table cell updates
    const observer = new MutationObserver(() => {
      simplifyForm();
      fixImages();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  return null
}

export const config = defineWidgetConfig({
  zone: [
    "product.list.after",
    "product.details.before",
    "order.list.after",
    "customer.list.after"
  ],
})

export default GlobalRoleManagerWidget