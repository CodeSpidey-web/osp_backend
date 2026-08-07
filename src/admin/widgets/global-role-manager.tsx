import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"
import { applySidebarRules } from "../routes/useRoleGuard"

const GlobalRoleManagerWidget = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/app/orders' || path === '/app/orders/' || path === '/app' || path === '/app/') {
        window.location.replace('/app/dashboard');
      }
    }
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

    const simplifyForm = () => {
      // Safely check if we are on the product creation route or looking at a dialog
      const containers: any[] = [];
      
      if (typeof window !== 'undefined' && window.location.pathname.includes('/products/create')) {
        const mainEl = document.querySelector('main') || document.querySelector('form');
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
        const elements = containerEl.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, span, p, label, button, a');
        elements.forEach((el: any) => {
          const elText = (el.textContent || '').trim().toLowerCase();
          if (!elText) return;

          // 1. Hide Options section & Variants toggle in details
          if (
            elText === 'options' || 
            elText === 'product options' || 
            elText === 'variants' || 
            elText.includes('has variants') || 
            elText.includes('multiple variants') ||
            elText.includes('when unchecked, we will create')
          ) {
            // If stepper item, hide it
            const stepperItem = el.closest('button') || el.closest('a') || el.closest('li') || el.closest('[role="tab"]');
            if (stepperItem && containerEl.contains(stepperItem) && (stepperItem.classList.contains('stepper-item') || stepperItem.textContent?.toLowerCase().includes('variants') || stepperItem.textContent?.toLowerCase().includes('pricing'))) {
              stepperItem.setAttribute('data-hide-product-field', 'true');
            }
            
            // Hide the variants card block by searching for the description container
            let parent = el.parentElement;
            let depth = 0;
            while (parent && parent !== containerEl && depth < 3) {
              const pText = parent.textContent || '';
              if (pText.includes('when unchecked, we will create') || pText.includes('is a product with variants')) {
                parent.setAttribute('data-hide-product-field', 'true');
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
          }
          
          // 2. Hide "Variants" and "Pricing" tabs in the sidebar stepper
          if (elText === 'variants' || elText === 'pricing') {
            const stepperItem = el.closest('button') || el.closest('a') || el.closest('li') || el.closest('[role="tab"]');
            if (stepperItem && containerEl.contains(stepperItem)) {
              stepperItem.setAttribute('data-hide-product-field', 'true');
            }
          }

          // 3. Hide Type (Optional) field container (hides both label and input box)
          if (elText.includes('type') && (elText.includes('optional') || elText === 'type')) {
            let parent = el.parentElement;
            let found = false;
            let depth = 0;
            while (parent && parent !== containerEl && depth < 3) {
              if (parent.querySelector('input') || parent.querySelector('select') || parent.querySelector('button') || parent.querySelector('[role="combobox"]')) {
                parent.setAttribute('data-hide-product-field', 'true');
                found = true;
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
            if (!found && el.parentElement) {
              el.parentElement.setAttribute('data-hide-product-field', 'true');
            }
          }

          // 4. Hide Collection (Optional) field container (hides both label and select box)
          if (elText.includes('collection') && (elText.includes('optional') || elText === 'collection')) {
            let parent = el.parentElement;
            let found = false;
            let depth = 0;
            while (parent && parent !== containerEl && depth < 3) {
              if (parent.querySelector('input') || parent.querySelector('select') || parent.querySelector('button') || parent.querySelector('[role="combobox"]')) {
                parent.setAttribute('data-hide-product-field', 'true');
                found = true;
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
            if (!found && el.parentElement) {
              el.parentElement.setAttribute('data-hide-product-field', 'true');
            }
          }

          // 5. Hide Discountable switch row container (hides both label and toggle switch)
          if (elText.includes('discountable') || elText.includes('discounts will not be applied')) {
            let parent = el.parentElement;
            let found = false;
            let depth = 0;
            while (parent && parent !== containerEl && depth < 3) {
              if (parent.querySelector('button[role="switch"]') || parent.querySelector('input[type="checkbox"]') || parent.classList.contains('flex-row') || parent.classList.contains('items-center')) {
                parent.setAttribute('data-hide-product-field', 'true');
                found = true;
                break;
              }
              parent = parent.parentElement;
              depth++;
            }
            if (!found && el.parentElement) {
              el.parentElement.setAttribute('data-hide-product-field', 'true');
            }
          }

          // Helper to hide container of a label
          const hideFieldContainer = (targetEl: any) => {
            let parent = targetEl.parentElement;
            let found = false;
            let depth = 0;
            while (parent && parent !== containerEl && depth < 4) {
              if (parent.querySelector('input') || parent.querySelector('select') || parent.querySelector('button') || parent.querySelector('[role="combobox"]') || parent.classList.contains('flex-col') || parent.classList.contains('grid')) {
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

          // 6. Hide Subtitle
          if (elText === 'subtitle' || (elText.includes('subtitle') && elText.includes('optional'))) {
            hideFieldContainer(el);
          }

          // 7. Hide Handle
          if (elText === 'handle' || (elText.includes('handle') && elText.includes('optional'))) {
            hideFieldContainer(el);
          }

          // 8. Hide Customs & Shipping (HS Code, Country of Origin, MID Code)
          if (
            elText === 'hs code' || 
            elText === 'mid code' || 
            elText.includes('country of origin') || 
            elText.includes('harmonized system code')
          ) {
            hideFieldContainer(el);
          }

          // 9. Hide Dimensions (Width, Height, Length, Weight)
          if (
            elText === 'width' || 
            elText === 'height' || 
            elText === 'length' || 
            elText === 'weight'
          ) {
            hideFieldContainer(el);
          }

          // 10. Hide Sales Channels and Metadata sections/fields
          if (
            elText === 'sales channels' || 
            elText === 'sales_channels' || 
            elText === 'metadata'
          ) {
            hideFieldContainer(el);
          }

          // 11. Hide entire card blocks/sections for Customs, Dimensions, Sales Channels, and Metadata on product page
          if (
            elText === 'customs' || 
            elText === 'sales channels' || 
            elText === 'metadata' ||
            elText === 'dimensions'
          ) {
            const cardBlock = el.closest('div.border, div.bg-card, section, [role="tabpanel"]');
            if (cardBlock && containerEl.contains(cardBlock)) {
              cardBlock.setAttribute('data-hide-product-field', 'true');
            }
          }
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
    "order.list.after",
    "customer.list.after"
  ],
})

export default GlobalRoleManagerWidget
