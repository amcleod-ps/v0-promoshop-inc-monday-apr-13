export type Locale = "CAN" | "USA"

export interface LocaleContact {
  addressLine1: string
  city: string
  region: string
  country: string
  phoneLabel: string
  phone: string
  phoneHref: string
}

export interface LocaleConfig {
  label: string
  shortLabel: string
  spelling: Record<string, string>
  primaryContact: LocaleContact
  allContacts: LocaleContact[]
  supportLineLabel: string
}

export const LOCALES: Record<Locale, LocaleConfig> = {
  CAN: {
    label: "Canada",
    shortLabel: "CAN",
    // Standard Canadian English keeps -ize/-ization (unlike British
    // English) while using -our and "catalogue"/"centre".
    spelling: {
      color: "colour",
      colors: "colours",
      Color: "Colour",
      Colors: "Colours",
      behavior: "behaviour",
      behaviors: "behaviours",
      catalog: "catalogue",
      Catalog: "Catalogue",
      center: "centre",
      organization: "organization",
      Organization: "Organization",
      customization: "customization",
      favorite: "favourite",
      recognized: "recognized",
    },
    primaryContact: {
      addressLine1: "3000 Marentette Avenue",
      city: "Windsor",
      region: "ON",
      country: "Canada",
      phoneLabel: "Windsor HQ",
      phone: "(519) 252-3005",
      phoneHref: "tel:5192523005",
    },
    allContacts: [
      {
        addressLine1: "3000 Marentette Avenue",
        city: "Windsor",
        region: "ON",
        country: "Canada",
        phoneLabel: "Windsor HQ",
        phone: "(519) 252-3005",
        phoneHref: "tel:5192523005",
      },
      {
        addressLine1: "Toronto Office",
        city: "Toronto",
        region: "ON",
        country: "Canada",
        phoneLabel: "Toronto",
        phone: "(416) 628-8512",
        phoneHref: "tel:4166288512",
      },
    ],
    supportLineLabel: "Need help? Give us a call: (519) 252-3005",
  },
  USA: {
    label: "United States",
    shortLabel: "USA",
    spelling: {
      color: "color",
      colors: "colors",
      Color: "Color",
      Colors: "Colors",
      behavior: "behavior",
      behaviors: "behaviors",
      catalog: "catalog",
      Catalog: "Catalog",
      center: "center",
      organization: "organization",
      Organization: "Organization",
      customization: "customization",
      favorite: "favorite",
      recognized: "recognized",
    },
    primaryContact: {
      addressLine1: "Detroit Office",
      city: "Detroit",
      region: "MI",
      country: "USA",
      phoneLabel: "Detroit",
      phone: "(248) 399-5410",
      phoneHref: "tel:2483995410",
    },
    allContacts: [
      {
        addressLine1: "Detroit Office",
        city: "Detroit",
        region: "MI",
        country: "USA",
        phoneLabel: "Detroit",
        phone: "(248) 399-5410",
        phoneHref: "tel:2483995410",
      },
    ],
    supportLineLabel: "Need help? Give us a call: (248) 399-5410",
  },
}

export const DEFAULT_LOCALE: Locale = "CAN"
