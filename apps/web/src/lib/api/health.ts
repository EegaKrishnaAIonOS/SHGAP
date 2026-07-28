import { publicFetch } from "./httpClient";
import type { HealthStatus } from "./types";

export function getHealth(): Promise<HealthStatus> {
  return publicFetch("/health");
}
