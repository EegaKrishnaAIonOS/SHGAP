import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

// Below this much room above the trigger, a tooltip placed above would
// clip against the viewport edge (e.g. DashboardNav sits right under the
// header) — flip to below instead. Comfortably covers the bubble's own
// height plus its arrow and a small gap on either side.
const MIN_SPACE_ABOVE_PX = 70;

// Smallest gap the bubble is allowed to end up from either side of the
// viewport once shifted off-center to avoid clipping.
const VIEWPORT_EDGE_MARGIN_PX = 8;

/**
 * A custom tooltip (native `title` has no arrow and inconsistent timing
 * across browsers) that points an arrow at its trigger and adjusts to the
 * screen on both axes: it flips between appearing above or below depending
 * on available room, and — since a trigger can sit close enough to the
 * left/right edge that a naively centered bubble would clip (e.g.
 * DashboardNav's leftmost tab) — shifts sideways to stay fully on-screen
 * while its arrow stays anchored to the trigger's actual center regardless
 * of that shift.
 */
export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  // How far the bubble is shifted from its default centered-on-trigger
  // position to stay clear of the viewport's left/right edges; the arrow
  // shifts by the same amount in the opposite direction (see below) so it
  // still points at the trigger even though the bubble moved.
  const [offsetX, setOffsetX] = useState(0);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  function show() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    setPlacement(rect && rect.top < MIN_SPACE_ABOVE_PX ? "bottom" : "top");
    setOffsetX(0);
    setIsOpen(true);
  }

  function hide() {
    setIsOpen(false);
  }

  // Runs after the bubble has rendered (so its real width is known) but
  // before the browser paints, so the shift never visibly flashes at the
  // wrong position first.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const bubble = bubbleRef.current;
    const wrapper = wrapperRef.current;
    if (!bubble || !wrapper) return;

    const bubbleRect = bubble.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const wrapperCenter = wrapperRect.left + wrapperRect.width / 2;
    const naturalLeft = wrapperCenter - bubbleRect.width / 2;
    const naturalRight = wrapperCenter + bubbleRect.width / 2;

    if (naturalLeft < VIEWPORT_EDGE_MARGIN_PX) {
      setOffsetX(VIEWPORT_EDGE_MARGIN_PX - naturalLeft);
    } else if (naturalRight > window.innerWidth - VIEWPORT_EDGE_MARGIN_PX) {
      setOffsetX(window.innerWidth - VIEWPORT_EDGE_MARGIN_PX - naturalRight);
    }
  }, [isOpen, label, placement]);

  return (
    <span
      ref={wrapperRef}
      className={cn("relative inline-flex", className)}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isOpen && (
        <span
          ref={bubbleRef}
          role="tooltip"
          style={{ transform: `translateX(calc(-50% + ${offsetX}px))` }}
          className={cn(
            "pointer-events-none absolute left-1/2 z-30 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-xs font-medium text-white shadow-lg",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {label}
          {/* A CSS border-triangle, not a rotated square — reads as an
              actual arrow tip instead of a diamond corner. Offset exactly
              matches the border width (4px = Tailwind's spacing "1") so its
              flat edge sits flush against the bubble with no gap — a
              mismatched offset here leaves a hairline seam between the two
              shapes instead of them reading as one. */}
          <span
            aria-hidden="true"
            style={{ transform: `translateX(calc(-50% - ${offsetX}px))` }}
            className={cn(
              "absolute left-1/2 h-0 w-0 border-x-4 border-x-transparent",
              placement === "top"
                ? "-bottom-1 border-t-4 border-t-neutral-800"
                : "-top-1 border-b-4 border-b-neutral-800",
            )}
          />
        </span>
      )}
    </span>
  );
}
