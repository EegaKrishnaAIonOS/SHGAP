import { useEffect, useRef, useState } from "react";
import { IconChip } from "./ui/IconChip";
import { Tooltip } from "./ui/Tooltip";
import { GlobeLinkIcon } from "./icons/GlobeLinkIcon";

/**
 * Centered icon in the header/main divider bar (see AppShell) that opens a
 * small dropdown of official government sites — currently just AP's portal,
 * but built as a list so more can be appended later without restructuring.
 */
export function GovtLinksMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const links = [{ label: "Government of Andhra Pradesh", href: "https://ap.gov.in" }];

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative flex justify-center">
      <Tooltip label="links">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Government links"
          className="group flex items-center justify-center"
        >
          <IconChip active={isOpen}>
            <GlobeLinkIcon className="h-4 w-4" />
          </IconChip>
        </button>
      </Tooltip>

      {isOpen && (
        <div
          role="menu"
          aria-label="Government links"
          className="absolute top-full z-20 mt-1 min-w-[240px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="block px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-100"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
