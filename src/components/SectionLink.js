"use client";

export default function SectionLink({ href, className, children }) {
  function handleClick(event) {
    if (!href.startsWith("#")) {
      return;
    }

    const target = document.getElementById(href.slice(1));

    if (!target) {
      return;
    }

    event.preventDefault();

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    target.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", href);
  }

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
