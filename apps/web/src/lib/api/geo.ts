import { authFetch } from "./httpClient";
import type { ReverseGeocodeResult } from "./types";

/**
 * Best-effort "we think you're in <district>" suggestion for the
 * registration geo-tag step — never authoritative. The caller must still
 * let the user confirm/override via the district dropdown.
 */
export function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  return authFetch<ReverseGeocodeResult>(`/geo/reverse?lat=${lat}&lng=${lng}`);
}
