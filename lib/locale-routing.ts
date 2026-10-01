import type { Locale } from "@/lib/cms/locale"

const DOMAIN_LOCALES = new Map<string, Locale>([
  ["promoshopstudio.ca", "CAN"],
  ["www.promoshopstudio.ca", "CAN"],
  ["promoshopstudio.com", "USA"],
  ["www.promoshopstudio.com", "USA"],
])

const LOCALE_HOSTS: Record<Locale, string> = {
  CAN: "www.promoshopstudio.ca",
  USA: "www.promoshopstudio.com",
}

export function getDomainLocale(hostname: string): Locale | undefined {
  return DOMAIN_LOCALES.get(hostname.toLowerCase())
}

export function getLocaleSwitchUrl(currentUrl: string, next: Locale): string | null {
  const url = new URL(currentUrl)
  const current = getDomainLocale(url.hostname)
  if (!current || current === next) return null

  url.protocol = "https:"
  url.hostname = LOCALE_HOSTS[next]
  url.port = ""
  url.username = ""
  url.password = ""
  return url.href
}
