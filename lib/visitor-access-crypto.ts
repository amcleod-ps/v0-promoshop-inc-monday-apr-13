import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

export const VISITOR_COOKIE = "studio-visitor"
export const SESSION_SECONDS = 60 * 60 * 24 * 7
export const PASSWORD_MAX_LENGTH = 256

export function passwordMatches(password: string, hash: string): boolean {
  if (password.length > PASSWORD_MAX_LENGTH) return false
  const [salt, expected] = hash.split(":")
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{64}$/.test(expected ?? "")) return false
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(expected, "hex"))
}

/** Strong enough for a shared site password: 10+ chars with a letter and a digit. */
export function passwordStrongEnough(password: string): boolean {
  if (password.length < 10 || password.length > PASSWORD_MAX_LENGTH) return false
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
}

/** Fresh scrypt hash in the same "saltHex:hashHex" format passwordMatches reads. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`
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
