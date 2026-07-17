import { authFetch, publicFetch } from "./httpClient";
import type { TokenPair } from "../auth/tokenStore";
import type { UserProfile } from "./types";

export function requestOtp(phone: string): Promise<{ message: string }> {
  return publicFetch<{ message: string }>("/auth/request-otp", {
    method: "POST",
    body: { phone },
  });
}

export function verifyOtp(phone: string, otp: string): Promise<TokenPair> {
  return publicFetch<TokenPair>("/auth/verify-otp", {
    method: "POST",
    body: { phone, otp },
  });
}

export function logout(refreshToken: string): Promise<void> {
  return publicFetch<void>("/auth/logout", {
    method: "POST",
    body: { refreshToken },
  });
}

export function getMe(): Promise<UserProfile> {
  return authFetch<UserProfile>("/users/me");
}
