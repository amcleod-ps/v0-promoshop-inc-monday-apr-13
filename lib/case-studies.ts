// Case studies shown on /case-studies. Copy is condensed from the PromoShop
// case-study decks (PromoShopInfo_Case_Studies_050522 pp. 3, 4, 6, 10 and
// IntrotoPS-2023-Capabilities pp. 31, 37). Images live in public/case-studies.

export interface CaseStudyImage {
  src: string
  alt: string
  /** Product cut-outs on transparent/white backgrounds sit on a light
   *  plinth; full-bleed photography fills the frame. */
  cutout?: boolean
}

export interface CaseStudyStat {
  value: string
  label: string
}

export interface CaseStudy {
  slug: string
  client: string
  title: string
  category: string
  /** Brand accent used for the section's glow and highlights. */
  accent: string
  images: CaseStudyImage[]
  /** Optional interactive 3D model (GLB) that can be spun in place.
   *  Generated with Higgsfield (Multi-Image to 3D) from the deck photos;
   *  textures re-encoded to 1024px JPEG to keep each file around 2 MB. */
  model?: { src: string; alt: string; /** Starting camera angle, e.g. "20deg 75deg". */ orbit?: string }
  challenge: string
  idea: string
  result?: string
  stats?: CaseStudyStat[]
  inside?: string[]
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "maserati",
    client: "Maserati",
    title: "Custom Clothing",
    category: "Custom apparel",
    accent: "#1f3a6e",
    images: [
      { src: "/case-studies/maserati-apparel.webp", alt: "Twelve Maserati-branded apparel pieces: tees, polos, hoodies and jackets", cutout: true },
      { src: "/case-studies/maserati-techpack.webp", alt: "Technical design sketch for the Maserati polo with trim and embroidery callouts", cutout: true },
    ],
    challenge: "Add premium apparel to Maserati's corporate dealer store.",
    idea: "A retail-inspired line that feels as premium as the cars, designed from first sketch to finished garment.",
    result: "12 unique pieces, custom designed and produced end to end.",
    stats: [{ value: "12", label: "custom apparel pieces" }],
  },
  {
    slug: "pabst-blue-ribbon",
    client: "Pabst Blue Ribbon",
    title: "Custom Vans Shoes",
    category: "Contest prize",
    accent: "#1f4fbf",
    images: [
      { src: "/case-studies/pbr-vans.webp", alt: "Custom white slip-on Vans covered in a blue Pabst Blue Ribbon print", cutout: true },
      { src: "/case-studies/pbr-vans-box.webp", alt: "The custom PBR Vans shown with their Vans shoebox", cutout: true },
    ],
    model: { src: "/case-studies/models/pbr-vans.glb", alt: "3D model of the custom Pabst Blue Ribbon Vans slip-on", orbit: "-15deg 72deg" },
    challenge: "PBR Canada asked a dozen distributors for a Back to School contest prize for its 20-packs.",
    idea: "Skip the usual. We pitched one-of-a-kind, fully custom PBR Vans.",
    result: "We won the RFQ. A dozen design rounds later, 230 pairs went on 20-pack cases across Canada.",
    stats: [
      { value: "230", label: "pairs produced" },
      { value: "12", label: "design concepts" },
    ],
  },
  {
    slug: "mopar",
    client: "Mopar",
    title: "Toolbox Fridge & BBQ Tools",
    category: "Dealer promotion",
    accent: "#1d5fd6",
    images: [
      { src: "/case-studies/mopar-fridge.webp", alt: "Blue Mopar-branded toolbox-style mini fridge with the door open", cutout: true },
      { src: "/case-studies/mopar-bbq-tools.webp", alt: "Mopar wrench-handled BBQ spatula, tongs and basting brush", cutout: true },
    ],
    model: { src: "/case-studies/models/mopar-fridge.glb", alt: "3D model of the Mopar toolbox fridge", orbit: "25deg 78deg" },
    challenge: "Bring more customers into Mopar Canada dealerships for summer servicing.",
    idea: "“The experts for your vehicle. The tools for your summer.” Custom BBQ sets, plus a raffle for a limited-edition toolbox fridge.",
    result: "Mopar's biggest promotion of the year.",
    stats: [
      { value: "1.5×", label: "the expected order" },
      { value: "150", label: "fridges raffled" },
      { value: "300+", label: "sold individually" },
    ],
  },
  {
    slug: "versailles",
    client: "Ovation TV · Versailles",
    title: "Versailles Media Mailer",
    category: "Launch kit",
    accent: "#8a1f24",
    images: [
      { src: "/case-studies/versailles-mailer.webp", alt: "Versailles keepsake box with saber USB, leather journal, wax seal stamp and sealed envelope" },
    ],
    challenge: "Launch BBC's Versailles in the US with a pre-launch kit for media buyers.",
    idea: "A 3D mailer with the feel of the French royal court: a sublimated leather-and-wood keepsake box sealed with the King's crown.",
    inside: ["Saber USB with teaser trailer", "Leather journal", "Crown wax-seal stamp", "Wax sticks", "Wax-sealed flyers"],
  },
  {
    slug: "perrier",
    client: "Perrier",
    title: "Modern Art Tray, Coasters & Drinkware",
    category: "Customer gift",
    accent: "#0f8a3c",
    images: [
      { src: "/case-studies/perrier-tray.webp", alt: "Acrylic Perrier street-art tray with matching coasters and four etched glasses" },
    ],
    challenge: "Celebrate Perrier's limited-edition street-art packaging with a gift for top customers.",
    idea: "Working with a Nestlé agency, a clean, colourful acrylic tray, matching coasters and four etched glasses.",
    stats: [
      { value: "3", label: "street artists" },
      { value: "9", label: "unique designs" },
    ],
  },
  {
    slug: "natgeo-sharkfest",
    client: "National Geographic",
    title: "Sharkfest ‘Finny’ Pack",
    category: "Press mailer",
    accent: "#e8b400",
    images: [
      { src: "/case-studies/natgeo-finny-pack.webp", alt: "Shark-shaped Sharkfest fanny pack with press box, shark book, bamboo USB and fish-themed snacks" },
    ],
    model: { src: "/case-studies/models/natgeo-finny-pack.glb", alt: "3D model of the shark-shaped Sharkfest ‘finny’ pack", orbit: "-10deg 75deg" },
    challenge: "Make the annual SHARKFEST press mailer feel new again.",
    idea: "Fanny packs are back, so we made a shark-shaped ‘finny’ pack, loaded with press materials, a bamboo USB and fish-themed snacks.",
    stats: [{ value: "350", label: "writers, bloggers & critics" }],
  },
]
