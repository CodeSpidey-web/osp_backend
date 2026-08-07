import React, { useEffect } from "react";
import { defineWidgetConfig } from "@medusajs/admin-sdk";

const HideCustomerGroupsTab = () => {
  useEffect(() => {
    const hideGroups = () => {
      // Hide the entire tablist bar (eliminates border and vertical spacing)
      const tabLists = document.querySelectorAll("[role='tablist']");
      tabLists.forEach((tabList) => {
        (tabList as HTMLElement).style.setProperty("display", "none", "important");
      });

      const elements = document.querySelectorAll("a, button, [role='tab'], [data-state]");
      elements.forEach((el) => {
        const text = el.textContent?.trim().toLowerCase();
        const href = (el as any).href || "";
        
        if (
          href.includes("/customers/groups") || 
          href.endsWith("/groups") || 
          text === "groups" || 
          text === "customer groups"
        ) {
          (el as HTMLElement).style.setProperty("display", "none", "important");
        }
      });
    };

    // Run initially
    hideGroups();

    // Use observer to monitor routing changes and client-side mounts
    const observer = new MutationObserver(() => {
      hideGroups();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      /* CSS Fallbacks */
      [role="tablist"] {
        display: none !important;
      }
      a[href*="/customers/groups"],
      a[href$="/customers/groups"],
      a[href*="/groups"][class*="tab"],
      a[href*="/groups"][class*="Button"],
      a[href*="/groups"] {
        display: none !important;
      }
    `}} />
  );
};

export const config = defineWidgetConfig({
  zone: "customer.list.before",
});

export default HideCustomerGroupsTab;
