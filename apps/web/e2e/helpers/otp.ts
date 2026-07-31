import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Reads the real OTP that auth.service.ts (T02) wrote to Redis for a
 * request-otp call, straight out of the shgap-redis container — the same
 * `docker exec ... redis-cli GET otp:code:<phone>` check used by hand for
 * every manual OTP verification pass in this repo (T18-T22). No test-only
 * bypass code exists in the app; this is what makes fully-automated login
 * possible against the real OTP flow instead of mocking it.
 */
export async function readOtpFromRedis(phone: string): Promise<string> {
  const { stdout } = await execFileAsync("docker", [
    "exec",
    "shgap-redis",
    "redis-cli",
    "GET",
    `otp:code:${phone}`,
  ]);
  const otp = stdout.trim();
  if (!otp) {
    throw new Error(`No OTP found in Redis for phone ${phone} — was requestOtp() called first?`);
  }
  return otp;
}
