import React, { useEffect } from "react";
import { defineWidgetConfig } from "@medusajs/admin-sdk";

const LoginBrandChanger = () => {
  useEffect(() => {
    const changeBrand = () => {
      // 1. Welcome Brand replacement
      const headings = document.querySelectorAll("h1, h2, h3");
      headings.forEach((el) => {
        const text = el.textContent?.trim();
        if (text === "Welcome to Medusa" || text === "Welcome back") {
          el.textContent = "Welcome to OSP Admin";
        }
      });

      // 2. Hide Forgot Password components safely
      const elements = document.querySelectorAll("a, button, p, span, div");
      elements.forEach((el) => {
        const text = el.textContent?.trim();
        if (!text) return;

        // Never hide containers that hold form inputs or the form itself
        if (el.querySelector("input, textarea, select, form")) {
          return;
        }

        const isForgotPassword = 
          text.toLowerCase().includes("forgot password") || 
          text === "Reset" ||
          text === "-" ||
          (el.tagName === "A" && (el as HTMLAnchorElement).href?.toLowerCase().includes("forgot-password"));

        if (isForgotPassword) {
          (el as HTMLElement).style.setProperty("display", "none", "important");
        }
      });
    };

    changeBrand();
    
    const observer = new MutationObserver(() => {
      changeBrand();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
};

export const config = defineWidgetConfig({
  zone: "login.before",
});

export default LoginBrandChanger;
