"use client";

import { useEffect } from "react";

export default function HomeScrollReveal() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll("[data-scroll-reveal]"),
    );

    if (elements.length === 0) {
      return undefined;
    }

    const revealAll = () => {
      elements.forEach((element) => {
        element.classList.add("is-visible");
      });
    };

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      revealAll();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return null;
}
