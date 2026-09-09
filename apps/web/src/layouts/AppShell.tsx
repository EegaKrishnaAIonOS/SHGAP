import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { PageAssistantTrigger } from "../components/PageAssistantTrigger";
import { TranslateMenu } from "../components/TranslateMenu";
import { getChatWidgetBridge, subscribeChatWidgetBridge } from "../lib/chatWidgetBridge";
import { cn } from "../lib/cn";
import { reapplyActiveTranslateLanguage } from "../lib/googleTranslate";
import type { UserProfile } from "../lib/api/types";

// Mirrors interface/script.js's own ROLE_REDIRECTS — kept in sync manually
// since that mockup login and this shell run in different runtimes.
// DISTRIBUTOR is core-api's real role name (OTP/password login);
// RETAILER is the guidance-api credential flow's own name for the same
// role (see interface/script.js) — both map to the same label here.
const ROLE_LABELS: Record<string, string> = {
  SHG: "shg member",
  DISTRICT: "district authority",
  DISTRIBUTOR: "retailer",
  RETAILER: "retailer",
  CONSUMER: "consumer",
};

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const IST_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** What clicking the header avatar actually does right now — see
 * LandingPage.tsx's handleAvatarClick, which this only mirrors for the
 * button's own label/icon. "dashboard": signed in but off their dashboard
 * (e.g. after navigating home via the logo) — takes them back to it. */
type AvatarAction = "login" | "logout" | "dashboard";

const AVATAR_ACTION_LABEL: Record<AvatarAction, string> = {
  login: "Login",
  logout: "Log out",
  dashboard: "Go to dashboard",
};

// logout-icon.svg for the one action that actually signs you out; every
// other action (including "dashboard", conceptually another way of
// entering) reuses the login/"enter" glyph rather than adding a new asset.
const AVATAR_ACTION_ICON: Record<AvatarAction, string> = {
  login: "/login-icon.svg",
  logout: "/logout-icon.svg",
  dashboard: "/login-icon.svg",
};

interface AppShellProps {
  isAuthenticated: boolean;
  avatarAction: AvatarAction;
  profile: UserProfile | null;
  /** True while the profile fetch that follows a login is still in flight
   * (see AuthContext.tsx). Kept separate from `profile` itself so the
   * greeting can tell "signed in, profile still loading" apart from
   * "signed in, profile fetch settled with nothing" — see displayName. */
  profileLoading: boolean;
  /** Shown under the greeting exactly as given — no ROLE_LABELS mapping, no
   * case change — instead of the friendly label normally derived from
   * `profile`. Set by LandingPage.tsx to the guidance-api credential flow's
   * own `info.role` (e.g. "SHG"), which isn't one of core-api's real role
   * names and shouldn't be relabeled like one. Undefined falls back to the
   * usual ROLE_LABELS-mapped label below. */
  roleLabelOverride?: string;
  /** Content for the thin divider bar between the header and the iframe
   * body — GovtLinksMenu on the marketing/guest pages, or a DashboardNav
   * mirroring whichever dashboard the iframe is currently showing (see
   * LandingPage.tsx, which decides which one based on the iframe's actual
   * content, not just its own route state). */
  topBar: ReactNode;
  onLogoClick: () => void;
  onAvatarClick: () => void;
  onLoginClick: () => void;
  children: ReactNode;
}

// Isolated so its once-a-second tick only re-renders this small subtree —
// keeping it inline in AppShell would re-render the whole header (including
// the "hello, {name}" greeting) every second. That churn is enough to fight
// with Google's Website Translator widget (see lib/googleTranslate.ts),
// which wraps translated text in its own <font> elements: constant nearby
// reconciliation was knocking that wrapping off the greeting node, so a
// translated language never stuck on it even though its text never
// actually changed.
function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <p className="text-sm font-semibold text-neutral-800">{IST_DATE_FORMATTER.format(now)}</p>
      <p className="text-xs text-neutral-500">{IST_TIME_FORMATTER.format(now)}</p>
    </>
  );
}

/**
 * Persistent fixed header + footer wrapping a single body slot (an iframe,
 * per the "fixed shell / iframe body" architecture — see
 * apps/web/src/pages/marketing/LandingPage.tsx). All page-to-page navigation
 * happens by the iframe navigating itself; this shell never remounts.
 */
export function AppShell({
  isAuthenticated,
  avatarAction,
  profile,
  profileLoading,
  roleLabelOverride,
  topBar,
  onLogoClick,
  onAvatarClick,
  onLoginClick,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  // No placeholder fallback ("Member"/"member") for a signed-in-but-unknown
  // state: isAuthenticated flips true the instant a token lands (see
  // tokenStore.ts), but the profile fetch it triggers is a separate, slower
  // round-trip, and AuthContext.tsx now clears auth entirely if that fetch
  // ever fails. So the only way to actually have a name here is a fetch
  // that's genuinely still in flight or has already succeeded — anything
  // else (not signed in, still loading, or a fetch that failed and thus
  // reverted isAuthenticated to false) shows "Guest", going straight from
  // that to the real name with nothing in between.
  const displayName = isAuthenticated && !profileLoading ? profile?.name || "Guest" : "Guest";
  const avatarSrc = (isAuthenticated && !profileLoading && profile?.avatar) || "/guest-avatar.svg";
  const roleLabel =
    roleLabelOverride ??
    ((isAuthenticated &&
      !profileLoading &&
      ROLE_LABELS[profile?.userRoles?.[0]?.role?.name ?? ""]) ||
      "guest");
  // Drives the 80/20 iframe/chat-panel split below — FloatingChatWidget
  // publishes isOpen here the same way it does for PageAssistantTrigger's
  // icon state (see lib/chatWidgetBridge.ts).
  // The blur+icon hover treatment only makes sense as an "about to sign you
  // out/in" warning — "dashboard" is a plain navigation, so the avatar stays
  // inert on hover for it.
  const showAvatarHoverIcon = avatarAction !== "dashboard";
  const chatBridge = useSyncExternalStore(subscribeChatWidgetBridge, getChatWidgetBridge);
  const isChatOpen = chatBridge?.isOpen ?? false;
  const isAnalyzingPage = chatBridge?.isAnalyzingPage ?? false;

  // Drag-to-resize the chat panel, bounded between its default 1/5 width and
  // half the screen (the iframe never gets squeezed past center). Dragged via
  // pointer capture (not plain mousemove) so the split keeps tracking even
  // once the cursor crosses over the iframe — a plain listener would stop
  // getting move events there, since the iframe is a separate document.
  const MIN_CHAT_PANEL_PCT = 20;
  const MAX_CHAT_PANEL_PCT = 50;
  const [chatPanelWidthPct, setChatPanelWidthPct] = useState(MIN_CHAT_PANEL_PCT);
  const [isResizingChatPanel, setIsResizingChatPanel] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const handleResizerPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizingChatPanel(true);
  }, []);

  const handleResizerPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = mainRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((rect.right - event.clientX) / rect.width) * 100;
    setChatPanelWidthPct(Math.min(MAX_CHAT_PANEL_PCT, Math.max(MIN_CHAT_PANEL_PCT, pct)));
  }, []);

  const handleResizerPointerEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsResizingChatPanel(false);
  }, []);

  // If a translation was already active when this greeting last changed
  // (e.g. it translated "Guest" right before a login inside the iframe
  // resolved to the real name — see tokenStore.ts's storage-event listener),
  // Google's widget owns the old DOM node and never notices the plain-React
  // text update that follows, leaving the stale "Guest" translation stuck.
  // Re-selecting the active language forces the widget to re-scan the page
  // against its current (now up to date) English content.
  useEffect(() => {
    reapplyActiveTranslateLanguage();
  }, [displayName, roleLabel]);

  return (
    <div className="flex min-h-dvh flex-col bg-white text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
        {/* Desktop: three equal-width columns, no divider. */}
        <div className="hidden md:flex">
          <div className="flex flex-1 items-center gap-2 px-3 py-2 sm:px-4">
            <button type="button" onClick={onLogoClick} aria-label="lakshmi">
              <img src="/favicon.png" alt="" className="h-10 w-10 shrink-0 rounded-md" />
            </button>
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-black">lakshmi</span>
              <span className="text-xs font-normal text-neutral-500">
                (an innovative SHG intelligent assistant)
              </span>
            </span>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-3 py-2 text-center leading-tight sm:px-4">
            <HeaderClock />
          </div>

          <div className="flex flex-1 items-center justify-end gap-3 px-3 py-2 sm:px-4">
            <div className="text-right leading-tight">
              {/* `key` forces a full remount (a brand-new DOM node) instead
                  of patching this <p>'s existing text in place. Once Google's
                  Website Translator has wrapped a node's text in its own
                  <font> elements, it only re-scans on genuinely new/removed
                  nodes — a plain characterData update (what React would
                  otherwise do here on logout/login/switching accounts) is
                  invisible to it, so the stale translation (e.g. a previous
                  account's name, or "Guest") stuck around forever even
                  though the underlying English text was already correct.
                  Prefixed (not the bare value) because these are two
                  siblings under the same parent — the guidance-api demo
                  accounts all have info.name === info.role (e.g. "SHG"),
                  so an unprefixed key={displayName}/key={roleLabel} pair
                  could collide on the same string and confuse React about
                  which sibling is which, leaving a stale node behind
                  instead of swapping it out. */}
              <p key={`name-${displayName}`} className="text-sm font-semibold text-neutral-800">
                hello, {displayName.toUpperCase()} !!
              </p>
              <p key={`role-${roleLabel}`} className="text-xs text-neutral-500">
                ({roleLabel})
              </p>
            </div>
            <button
              type="button"
              onClick={onAvatarClick}
              aria-label={AVATAR_ACTION_LABEL[avatarAction]}
              className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
            >
              <img
                src={avatarSrc}
                alt=""
                className={cn(
                  "h-10 w-10 rounded-full object-cover transition duration-150",
                  showAvatarHoverIcon && "group-hover:blur-sm",
                )}
              />
              {showAvatarHoverIcon && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition duration-150 group-hover:opacity-100">
                  <img
                    src={AVATAR_ACTION_ICON[avatarAction]}
                    alt=""
                    className="h-4 w-4 brightness-0 invert"
                  />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile: single row, no dividers/clock — keeps the header compact. */}
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 md:hidden">
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onLogoClick} aria-label="lakshmi">
              <img src="/favicon.png" alt="" className="h-9 w-9 shrink-0 rounded-md" />
            </button>
            <span className="flex flex-col leading-tight">
              <span className="text-lg font-semibold text-black">lakshmi</span>
              <span className="text-xs font-normal text-neutral-500">
                (an innovative SHG intelligent assistant)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAvatarClick}
              aria-label={AVATAR_ACTION_LABEL[avatarAction]}
              className="group relative h-9 w-9 shrink-0 overflow-hidden rounded-full"
            >
              <img
                src={avatarSrc}
                alt=""
                className={cn(
                  "h-9 w-9 rounded-full object-cover transition duration-150",
                  showAvatarHoverIcon && "group-hover:blur-sm",
                )}
              />
              {showAvatarHoverIcon && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition duration-150 group-hover:opacity-100">
                  <img
                    src={AVATAR_ACTION_ICON[avatarAction]}
                    alt=""
                    className="h-3.5 w-3.5 brightness-0 invert"
                  />
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
              className="flex h-10 w-10 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                {menuOpen ? "✕" : "☰"}
              </span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            aria-label="Primary"
            className="flex flex-col gap-1 border-t border-neutral-200 px-4 py-3 md:hidden"
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onLoginClick();
              }}
              className="min-h-touch flex items-center rounded-md px-2 text-base font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Login
            </button>
          </nav>
        )}
      </header>

      {/* No justify-center here — GovtLinksMenu centers itself (see
          LandingPage.tsx's own wrapper around it) but DashboardNav spans
          the full width itself, tabs left-aligned/avatar right-aligned. */}
      <div className="flex h-7 w-full items-center border-b border-neutral-200 bg-neutral-100">
        {topBar}
      </div>

      <main ref={mainRef} className="relative flex min-h-0 flex-1">
        {/* No explicit height here — flex stretch (the row main's default
            align-items) sizes this reliably, unlike `h-full`, which is a
            percentage height and silently fails to resolve against a flex
            item whose own height came from flex-grow (see the iframe's own
            absolute+inset-0 for why that pattern is used instead of h-full
            wherever something needs to fill a flex-sized ancestor). */}
        <div
          className={cn("relative", !isResizingChatPanel && "transition-[width] duration-200")}
          style={{ width: isChatOpen ? `${100 - chatPanelWidthPct}%` : "100%" }}
        >
          {children}
          {/* Swallows hover/pointer events over the iframe while dragging —
              without it, the iframe (a separate document) would stop the
              parent window from seeing pointermove once the cursor crosses
              into it, freezing the drag. */}
          {isResizingChatPanel && (
            <div className="absolute inset-0 z-30 cursor-col-resize" aria-hidden="true" />
          )}
          {isAnalyzingPage && (
            <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
              <span className="iframe-ripple" style={{ width: "20%" }} />
              <span className="iframe-ripple" style={{ width: "60%", animationDelay: "0.45s" }} />
              <span className="iframe-ripple" style={{ width: "80%", animationDelay: "0.9s" }} />
              <span className="iframe-ripple" style={{ width: "100%", animationDelay: "1.35s" }} />
            </div>
          )}
        </div>
        {/* Always mounted (zero-width when the chat is closed) so
            FloatingChatWidget's one-time slot lookup on mount always finds
            it, regardless of open/close timing — see chatWidgetBridge.ts
            and FloatingChatWidget's chatPanelSlot effect. */}
        <div
          id="chat-panel-slot"
          className={cn(
            "relative shrink-0 overflow-hidden",
            !isResizingChatPanel && "transition-[width] duration-200",
            isChatOpen && "border-l border-neutral-200",
          )}
          style={{ width: isChatOpen ? `${chatPanelWidthPct}%` : "0%" }}
        />
        {/* Absolutely positioned (rather than a flex sibling) so its own
            fixed hit-area width never adds to the two panels' 100% split -
            it just floats over the seam between them. */}
        {isChatOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat panel"
            onPointerDown={handleResizerPointerDown}
            onPointerMove={handleResizerPointerMove}
            onPointerUp={handleResizerPointerEnd}
            onPointerCancel={handleResizerPointerEnd}
            className="group absolute inset-y-0 z-40 w-3 -translate-x-1/2 cursor-col-resize touch-none"
            style={{ left: `${100 - chatPanelWidthPct}%` }}
          >
            <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 group-hover:bg-brand-400/40" />
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-neutral-200 bg-white">
        <div className="flex h-7 w-full items-center justify-between border-b border-neutral-200 bg-neutral-100 px-3 sm:px-4">
          <TranslateMenu />
          <PageAssistantTrigger />
        </div>

        {/* Desktop: three equal-width columns, matching the header. */}
        <div className="hidden items-center md:flex">
          <div className="flex flex-1 items-center px-3 py-2 sm:px-4">
            <img src="/aionos-logo.jpg" alt="Aionos AI logo" className="h-7 w-auto shrink-0" />
          </div>
          <div className="flex flex-1 items-center justify-center px-3 py-2 sm:px-4">
            <img
              src="/ap-emblem.png"
              alt="Government of Andhra Pradesh emblem"
              className="h-10 w-10 shrink-0"
            />
          </div>
          <div className="flex flex-1 items-center justify-end px-3 py-2 sm:px-4">
            <img src="/india-ai-logo.png" alt="India AI logo" className="h-10 w-auto shrink-0" />
          </div>
        </div>

        {/* Mobile: single row, logo flush left like the header's mobile row. */}
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 md:hidden">
          <img src="/aionos-logo.jpg" alt="Aionos AI logo" className="h-[1.2rem] w-auto shrink-0" />
          <img
            src="/ap-emblem.png"
            alt="Government of Andhra Pradesh emblem"
            className="h-9 w-9 shrink-0"
          />
          <img src="/india-ai-logo.png" alt="India AI logo" className="h-9 w-auto shrink-0" />
        </div>
      </footer>
    </div>
  );
}
