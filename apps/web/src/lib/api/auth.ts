import { authFetch, publicFetch } from "./httpClient";
import type { TokenPair } from "../auth/tokenStore";
import type { SelfRegisterableRole, UserProfile, UserStatus } from "./types";

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

export interface RegisterPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  confirmPassword: string;
  role: SelfRegisterableRole;
  termsAccepted: boolean;
}

export interface RegisterResponse {
  status: UserStatus;
  role: SelfRegisterableRole;
  message: string;
}

/** Self-registration for the SHG/Distributor/Consumer personas — a separate
 * account-creation path from the phone-OTP flow above. Never returns tokens:
 * the caller must still log in afterwards via loginWithPassword. */
export function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return publicFetch<RegisterResponse>("/auth/register", {
    method: "POST",
    body: payload,
  });
}

export function loginWithPassword(
  email: string,
  password: string,
  rememberMe?: boolean,
): Promise<TokenPair> {
  return publicFetch<TokenPair>("/auth/login", {
    method: "POST",
    body: { email, password, rememberMe },
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return publicFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ message: string }> {
  return publicFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword, confirmPassword },
  });
}

export interface VerifyEmailResponse {
  status: UserStatus;
  role: SelfRegisterableRole;
  message: string;
}

/** Confirms the token from the emailed verification link — moves CONSUMER to
 * ACTIVE or SHG/DISTRIBUTOR to PENDING_APPROVAL (see AuthService.verifyEmail
 * on the backend). */
export function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  return publicFetch<VerifyEmailResponse>("/auth/verify-email", {
    method: "POST",
    body: { token },
  });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return publicFetch<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: { email },
  });
}
