import { useEffect, useState, useSyncExternalStore, type SyntheticEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../../layouts/AppShell";
import { DashboardNav, type DashboardTabInfo } from "../../components/DashboardNav";
import { DashboardRoleNav, type DashboardRoleGroup } from "../../components/DashboardRoleNav";
import { GovtLinksMenu } from "../../components/GovtLinksMenu";
import { useAuth } from "../../context/AuthContext";
import {
  clearGuidanceSession,
  getGuidanceSession,
  subscribeGuidanceSession,
} from "../../lib/auth/guidanceSessionStore";
import { reapplyActiveTranslateLanguage } from "../../lib/googleTranslate";
import type { UserProfile } from "../../lib/api/types";

const INDEX_SRC = "/interface/index.html";
const LOGIN_SRC = "/interface/login.html";

// Persists wherever the iframe last navigated to (including its own internal
// navigation via interface/script.js, not just React-driven setIframeSrc
// calls) so a browser reload can restore that same page instead of always
// falling back to the guest hero or role default. Session-scoped rather than
// localStorage: a closed tab/new session should still start fresh.
const IFRAME_SRC_STORAGE_KEY = "shgap.iframe.src";

// Mirrors interface/script.js's ROLE_DASHBOARD_FILENAMES — kept in sync
// manually since the two run in different runtimes (this shell in React,
// that in a plain <script> inside the iframe) and can't share a literal
// object.
const ROLE_DASHBOARD_SRC: Record<string, string> = {
  SHG: "/interface/console/dashboard-shg.html",
  DISTRIBUTOR: "/interface/console/dashboard-retailer.html",
  RETAILER: "/interface/console/dashboard-retailer.html",
  CONSUMER: "/interface/console/dashboard-consumer.html",
  DISTRICT: "/interface/console/dashboard-district.html",
  STATE: "/interface/console/dashboard-state.html",
  AIONOS: "/interface/console/dashboard-aionos.html",
};

// Display order in the outer nav — deliberately not the same order as the
// iframe's own (now hidden) tab strip, which has "Insights" before "Open
// Contributions"; the outer nav shows the disabled Contributions tab first
// so Insights ends up next to it instead. Anything else not listed keeps
// whatever order it was found in, after these.
const TAB_DISPLAY_ORDER = ["raw-materials", "items", "catalog", "contributions", "insights"];

type DashboardKind = "SHG" | "DISTRIBUTOR" | "CONSUMER" | null;

// District/state authority accounts (see inference/tools/database.py's
// func__init_credential) have no `name` field at all — they're an office,
// not a person — so guidanceSession.info.name is always undefined for them.
// Without this, AppShell's greeting falls back to "Guest" while the role
// line right below it still says "(district)"/"(state)", a contradictory
// "hello, GUEST !! (district)" header. Mirrors interface/script.js's own
// resolveAuthority() naming for the same roles.
function titleCase(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function guidanceDisplayName(info: {
  role?: string;
  name?: string;
  district_name?: string;
  organisation?: string;
}): string | null {
  if (info.name) return info.name;
  if (info.role === "district" && info.district_name) {
    return `${titleCase(info.district_name)} District Authority`;
  }
  if (info.role === "state") return "Andhra Pradesh State Authority";
  // The AIONOS account (see inference/tools/database.py's
  // func__init_credential) has no `role`/`name`, just an `organisation` —
  // same fallback LandingPage already applies for its role name below.
  if (info.organisation === "AIONOS") return "AIONOS";
  return null;
}

// Which dashboard the iframe is currently showing, from its URL — lets
// DashboardNav override its usual label-based icon matching for the two
// single-tab dashboards (see DashboardNav.tsx's swap for Retailer/Consumer)
// without needing a role→icon map duplicated here too.
function getDashboardKind(pathname: string): DashboardKind {
  if (pathname.includes("dashboard-shg")) return "SHG";
  if (pathname.includes("dashboard-retailer")) return "DISTRIBUTOR";
  if (pathname.includes("dashboard-consumer")) return "CONSUMER";
  return null;
}

// Reads the current dashboard's tab strip straight off the iframe's own
// markup (see interface/console/*.html) rather than duplicating a
// role→tabs map here — null when there isn't one (the marketing hero,
// login), which is also how AppShell knows to fall back to GovtLinksMenu
// instead of a DashboardNav.
function readDashboardTabs(doc: Document | null): DashboardTabInfo[] | null {
  if (!doc) return null;
  const tabs = [...doc.querySelectorAll<HTMLButtonElement>(".shg-tab")].map((tab) => ({
    dataTab: tab.dataset.tab ?? "",
    label: tab.textContent?.trim() ?? "",
    active: tab.classList.contains("active"),
    disabled: tab.classList.contains("shg-tab-disabled"),
    // Each disabled tab's own reason (e.g. "Deprecated — moving to
    // chatbot" vs. "Open Contributions — Coming Soon") — see the title
    // attributes in interface/console/*.html and script.js's toast, which
    // reads the same attribute for the same reason.
    disabledReason: tab.title || undefined,
  }));
  if (tabs.length === 0) return null;
  tabs.sort((a, b) => {
    const orderA = TAB_DISPLAY_ORDER.indexOf(a.dataTab);
    const orderB = TAB_DISPLAY_ORDER.indexOf(b.dataTab);
    return (orderA === -1 ? Infinity : orderA) - (orderB === -1 ? Infinity : orderB);
  });
  return tabs;
}

// Reads the supervisory dashboards' own role-avatar groups (see
// interface/console/dashboard-{district,state,aionos}.html's
// `.shg-role-avatar` elements) straight off the iframe's markup, same as
// readDashboardTabs above — null when there aren't any (every other
// dashboard, which uses the flat DashboardNav instead; see topBar below).
function readDashboardRoleNav(doc: Document | null): DashboardRoleGroup[] | null {
  if (!doc) return null;
  const groups = [...doc.querySelectorAll<HTMLElement>(".shg-role-avatar")].map((el) => ({
    role: el.dataset.role ?? "",
    label: el.dataset.label ?? el.dataset.role ?? "",
    color: el.dataset.color ?? "black",
    items: [...el.querySelectorAll<HTMLButtonElement>(".shg-tab")].map((tab) => ({
      dataTab: tab.dataset.tab ?? "",
      label: tab.textContent?.trim() ?? "",
      active: tab.classList.contains("active"),
      disabled: tab.classList.contains("shg-tab-disabled"),
      disabledReason: tab.title || undefined,
    })),
  }));
  return groups.length > 0 ? groups : null;
}

/** Public entry point at `/` — a persistent fixed header/footer (AppShell)
 * wrapping a single iframe body. The iframe's starting page is the only
 * thing this shell decides (guest vs. signed-in role); every navigation
 * after that — login, moving between dashboard pages — happens by the
 * iframe navigating itself (see interface/script.js), not by this shell
 * changing state. Not gated behind auth; the previous "/" dev/QA route
 * index now lives at /_dev (see DevIndexPage). */
export function LandingPage() {
  const { isAuthenticated, profile, profileLoading, logout } = useAuth();
  // A second, independent "am I signed in" source — interface/script.js's
  // own guidance-api credential login (see that file's passwordForm submit
  // handler), which has no real access/refresh tokens to hand useAuth's
  // tokenStore, so it gets its own store instead. Whichever one is active
  // wins below; both being active at once isn't a real scenario (this
  // shell only ever drives one login flow at a time).
  const guidanceSession = useSyncExternalStore(subscribeGuidanceSession, getGuidanceSession);
  const effectiveIsAuthenticated = isAuthenticated || Boolean(guidanceSession);
  const effectiveProfile: UserProfile | null = guidanceSession
    ? {
        id: guidanceSession.email,
        phone: guidanceSession.info.contact ?? "",
        email: guidanceSession.email,
        name: guidanceDisplayName(guidanceSession.info),
        avatar: guidanceSession.info.avatar,
        // The AIONOS account (see inference/tools/database.py's
        // func__init_credential) has no `role` field, just an
        // `organisation` — identified that way instead here, same as
        // interface/script.js's login handler.
        userRoles: [
          {
            id: guidanceSession.email,
            role: {
              name:
                guidanceSession.info.role ||
                (guidanceSession.info.organisation === "AIONOS" ? "AIONOS" : undefined),
            },
          },
        ],
      }
    : profile;
  const effectiveProfileLoading = guidanceSession ? false : profileLoading;
  const [searchParams, setSearchParams] = useSearchParams();
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  // Null whenever the iframe isn't on a dashboard page (the marketing hero,
  // login — anything without a `.shg-tab` strip of its own). Drives whether
  // AppShell's divider bar shows GovtLinksMenu or a DashboardNav — see
  // topBar below.
  const [dashboardTabs, setDashboardTabs] = useState<DashboardTabInfo[] | null>(null);
  const [dashboardKind, setDashboardKind] = useState<DashboardKind>(null);
  // Only set for the supervisory dashboards (district/state/aionos) — see
  // readDashboardRoleNav and topBar below, which renders DashboardRoleNav
  // instead of the flat DashboardNav whenever this is non-null.
  const [dashboardRoleNav, setDashboardRoleNav] = useState<DashboardRoleGroup[] | null>(null);

  // Decides the iframe's *starting* src exactly once. A `?auth=login`
  // deep-link (from /login, /signup, /register — see App.tsx) always wins;
  // otherwise a guest lands on the marketing hero and a signed-in member
  // lands straight on their role's dashboard. Waits out `profileLoading`
  // first so an authenticated reload doesn't flash the guest hero before
  // the role is known.
  useEffect(() => {
    if (iframeSrc) return;

    const requestedAuth = searchParams.get("auth");
    if (requestedAuth === "login") {
      setIframeSrc(LOGIN_SRC);
      setSearchParams(
        (params) => {
          params.delete("auth");
          return params;
        },
        { replace: true },
      );
      return;
    }

    if (effectiveIsAuthenticated && effectiveProfileLoading) return;

    // A reload should land back on whatever page the iframe was actually
    // showing (including pages it navigated to on its own), not reset to the
    // guest hero or role default.
    const persistedSrc = sessionStorage.getItem(IFRAME_SRC_STORAGE_KEY);
    if (persistedSrc) {
      setIframeSrc(persistedSrc);
      return;
    }

    if (effectiveIsAuthenticated) {
      const role = effectiveProfile?.userRoles?.[0]?.role?.name;
      setIframeSrc((role && ROLE_DASHBOARD_SRC[role.toUpperCase()]) || INDEX_SRC);
    } else {
      setIframeSrc(INDEX_SRC);
    }
  }, [
    iframeSrc,
    effectiveIsAuthenticated,
    effectiveProfile,
    effectiveProfileLoading,
    searchParams,
    setSearchParams,
  ]);

  // Mirrors the iframe's real current location into sessionStorage on every
  // load it does — both ones this shell triggers via setIframeSrc and ones
  // interface/script.js triggers by navigating the iframe itself, which this
  // shell has no other way of observing (see LandingPage's class comment).
  function handleIframeLoad(event: SyntheticEvent<HTMLIFrameElement>) {
    reapplyActiveTranslateLanguage();
    try {
      const location = event.currentTarget.contentWindow?.location;
      if (location) {
        sessionStorage.setItem(IFRAME_SRC_STORAGE_KEY, location.pathname + location.search);
        setDashboardKind(getDashboardKind(location.pathname));
      }
    } catch {
      // Cross-origin access would throw - these pages are always same-origin
      // in practice, but restoring the last page on reload is a nice-to-have
      // that shouldn't ever break the load itself.
    }
    setDashboardTabs(readDashboardTabs(event.currentTarget.contentDocument));
    setDashboardRoleNav(readDashboardRoleNav(event.currentTarget.contentDocument));
  }

  // Forwards a click to the iframe's own (now visually hidden — see
  // interface/styles.css's `.shg-tabs`) tab button, so all the actual
  // switching logic (toggling panels, the disabled tab's "Coming Soon"
  // toast) still lives in exactly one place: interface/script.js. Then
  // re-reads the tabs straight back off the DOM, since that click ran
  // synchronously and the classes it toggled are already settled by the
  // time this runs — no separate "which tab is active" state to keep in
  // sync by hand.
  function handleDashboardTabClick(dataTab: string) {
    const doc = document.querySelector<HTMLIFrameElement>("#app-body-iframe")?.contentDocument;
    if (!doc) return;
    doc.querySelector<HTMLButtonElement>(`.shg-tab[data-tab="${dataTab}"]`)?.click();
    setDashboardTabs(readDashboardTabs(doc));
    setDashboardRoleNav(readDashboardRoleNav(doc));
  }

  // Only truthy while the iframe is actually showing one of the
  // interface/console/*.html dashboards (see readDashboardTabs) — everywhere
  // else counts as "home" for this purpose, including the marketing hero,
  // login, and signup.
  const onDashboard = dashboardTabs !== null;

  async function handleAvatarClick() {
    if (!effectiveIsAuthenticated) {
      setIframeSrc(LOGIN_SRC);
      return;
    }
    if (onDashboard) {
      if (guidanceSession) {
        clearGuidanceSession();
      } else {
        await logout();
      }
      sessionStorage.removeItem(IFRAME_SRC_STORAGE_KEY);
      setIframeSrc(INDEX_SRC);
      return;
    }
    // Signed in but away from their dashboard (e.g. navigated home via the
    // logo) — take them back to it instead of logging them out.
    const role = effectiveProfile?.userRoles?.[0]?.role?.name;
    setIframeSrc((role && ROLE_DASHBOARD_SRC[role.toUpperCase()]) || INDEX_SRC);
  }

  return (
    <AppShell
      isAuthenticated={effectiveIsAuthenticated}
      avatarAction={!effectiveIsAuthenticated ? "login" : onDashboard ? "logout" : "dashboard"}
      profile={effectiveProfile}
      profileLoading={effectiveProfileLoading}
      roleLabelOverride={
        guidanceSession?.info.role ??
        (guidanceSession?.info.organisation === "AIONOS" ? "AIONOS" : undefined)
      }
      topBar={
        dashboardRoleNav ? (
          <DashboardRoleNav groups={dashboardRoleNav} onItemClick={handleDashboardTabClick} />
        ) : dashboardTabs ? (
          <DashboardNav
            tabs={dashboardTabs}
            onTabClick={handleDashboardTabClick}
            profile={effectiveProfile}
            guidanceSession={guidanceSession}
            isProfileActive={dashboardTabs.some((t) => t.dataTab === "profile" && t.active)}
            onOpenProfilePage={() => handleDashboardTabClick("profile")}
            dashboardKind={dashboardKind}
          />
        ) : (
          <div className="flex w-full justify-center">
            <GovtLinksMenu />
          </div>
        )
      }
      onLogoClick={() => setIframeSrc(INDEX_SRC)}
      onAvatarClick={() => void handleAvatarClick()}
      onLoginClick={() => setIframeSrc(LOGIN_SRC)}
    >
      {iframeSrc && (
        <iframe
          id="app-body-iframe"
          src={iframeSrc}
          title="Lakshmi"
          className="absolute inset-0 h-full w-full border-0"
          // Fires on every load this iframe does, including ones it
          // triggers itself by navigating internally (interface/script.js)
          // rather than through iframeSrc state — see handleIframeLoad and
          // reapplyActiveTranslateLanguage for why that matters: neither the
          // translate widget nor this shell's reload-restore logic has any
          // other way to know a whole new document just loaded in here on
          // its own.
          onLoad={handleIframeLoad}
        />
      )}
    </AppShell>
  );
}
