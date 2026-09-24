import { createHmac, scryptSync, timingSafeEqual } from "node:crypto"

export const VISITOR_COOKIE = "studio-visitor"
export const SESSION_SECONDS = 60 * 60 * 24 * 7

export function passwordMatches(password: string, hash: string): boolean {
  if (password.length > 256) return false
  const [salt, expected] = hash.split(":")
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{64}$/.test(expected ?? "")) return false
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(expected, "hex"))
}

export function signSession(hash: string, expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS): string {
  return `${expires}.${createHmac("sha256", hash).update(`visitor:${expires}`).digest("hex")}`
}

export function validSession(value: string | undefined, hash: string): boolean {
  if (!value || !/^\d{10}\.[a-f0-9]{64}$/.test(value)) return false
  const expires = Number(value.split(".")[0])
  const now = Math.floor(Date.now() / 1000)
  if (expires <= now || expires > now + SESSION_SECONDS) return false
  return timingSafeEqual(Buffer.from(value), Buffer.from(signSession(hash, expires)))
}
