export interface ProductColour {
  name: string
  hex: string
  images: string[]
}

export interface Product {
  sku: string
  name: string
  category: string
  brands: string[]
  gender: string[]
  colours: ProductColour[]
  sizes: string[]
  minQty: number
  description?: string
  decoLocations?: string[]
  decoMethods?: string[]
}

// Product data from Abigail's Studio code
export const PRODUCTS: Product[] = [
  { 
    sku: "DRK 004", 
    name: "VSSL Rift Tumbler 16 oz", 
    category: "Drinkware", 
    brands: ["VSSL"], 
    gender: ["Unisex"], 
    colours: [
      { name: "Sahara", hex: "#c4a96e", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/fa86c508-f30b-4a15-9759-a33ac25648b5/Rift+Tumbler.png?format=1500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/75d6f125-ede1-4cf6-a3fe-867ce8204ed9/63.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/0ccfea25-7f4c-4a59-b611-dd8a71e94b3a/64.png?format=500w"] },
      { name: "Pacific Blue", hex: "#2e7fa0", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/fa86c508-f30b-4a15-9759-a33ac25648b5/Rift+Tumbler.png?format=1500w"] },
      { name: "Ash", hex: "#b0aba3", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/fa86c508-f30b-4a15-9759-a33ac25648b5/Rift+Tumbler.png?format=1500w"] },
      { name: "Stone", hex: "#c2b89a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/fa86c508-f30b-4a15-9759-a33ac25648b5/Rift+Tumbler.png?format=1500w"] },
      { name: "Wild Sage", hex: "#8aad7e", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/fa86c508-f30b-4a15-9759-a33ac25648b5/Rift+Tumbler.png?format=1500w"] }
    ], 
    sizes: ["16oz"], 
    minQty: 24,
    description: "Premium 16oz tumbler with double-wall vacuum insulation. Perfect for hot or cold beverages on the go."
  },
  { 
    sku: "DRK 008", 
    name: "VSSL Nest Mug 10oz", 
    category: "Drinkware", 
    brands: ["VSSL"], 
    gender: ["Unisex"], 
    colours: [
      { name: "Black", hex: "#1a1a1a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/97710ecf-2ead-46ed-9603-f3dfa1b330c5/Nest+Mug+10+oz.png?format=2500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/b1508abb-a2c3-4023-9815-c20d92418c13/66.png?format=2500w"] },
      { name: "Cream", hex: "#f5eed8", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/97710ecf-2ead-46ed-9603-f3dfa1b330c5/Nest+Mug+10+oz.png?format=2500w"] }
    ], 
    sizes: ["10oz"], 
    minQty: 24,
    description: "Compact 10oz mug with stackable design. Great for travel and outdoor adventures."
  },
  // TOP 001 - Updated colorways per Abigail's email
  { 
    sku: "TOP 001", 
    name: "Rhone Course to Court 1/4 Zip", 
    category: "Tops", 
    brands: ["Rhone"], 
    gender: ["Womens"], 
    colours: [
      { name: "Snow White", hex: "#f8f8f8", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/e0a608f2-3047-4dc0-abb4-c652614d0bd4/Rhone+WOmens+1_4+Zip.png?format=2500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/fecd0893-d632-4760-af45-dbc8632ca975/57.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/a0316386-e8a7-40a6-a8d5-63d4b46282c3/58.png?format=500w"] },
      { name: "Navy Blue", hex: "#1b2a4a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/e0a608f2-3047-4dc0-abb4-c652614d0bd4/Rhone+WOmens+1_4+Zip.png?format=2500w"] },
      { name: "Sand", hex: "#d4c5a0", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/e0a608f2-3047-4dc0-abb4-c652614d0bd4/Rhone+WOmens+1_4+Zip.png?format=2500w"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/e0a608f2-3047-4dc0-abb4-c652614d0bd4/Rhone+WOmens+1_4+Zip.png?format=2500w"] }
    ], 
    sizes: ["XS", "S", "M", "L", "XL", "XXL"], 
    minQty: 24,
    description: "Versatile 1/4 zip pullover designed for performance. Moisture-wicking fabric with 4-way stretch."
  },
  // TOP 009 - Updated per Abigail: Mens only, updated colorways
  { 
    sku: "TOP 009", 
    name: "Rhone Rise 1/4 Zip", 
    category: "Tops", 
    brands: ["Rhone"], 
    gender: ["Mens"], 
    colours: [
      { name: "Black", hex: "#1a1a1a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/0fc09448-21b2-4623-b0e3-11e14d045449/Rhone+Mens+Rise+1_4+Zip.png?format=2500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/cf5eb53e-5807-49b1-9aec-5aa323de7f57/60.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/e7fea4b4-15e7-4483-b0ca-b735cf51d491/61.png?format=500w"] },
      { name: "Bright White", hex: "#ffffff", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/0fc09448-21b2-4623-b0e3-11e14d045449/Rhone+Mens+Rise+1_4+Zip.png?format=2500w"] },
      { name: "Navy Blue", hex: "#1b2a4a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/0fc09448-21b2-4623-b0e3-11e14d045449/Rhone+Mens+Rise+1_4+Zip.png?format=2500w"] },
      { name: "Asphalt", hex: "#5c5c5c", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/0fc09448-21b2-4623-b0e3-11e14d045449/Rhone+Mens+Rise+1_4+Zip.png?format=2500w"] }
    ], 
    sizes: ["S", "M", "L", "XL", "XXL"], 
    minQty: 24,
    description: "Premium quarter-zip with soft-touch fabric. Perfect for layering or standalone wear."
  },
  // JAK 003 - Updated colorways per Abigail's email
  { 
    sku: "JAK 003", 
    name: "Patagonia Better Sweater Jacket", 
    category: "Jackets", 
    brands: ["Patagonia"], 
    gender: ["Mens"], 
    colours: [
      { name: "Black", hex: "#1a1a1a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/d08f303f-e454-4e6a-ba6f-5487ae4dc09f/Mens+Pat+Better+Sweater+Jacket.png?format=2500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/4ad54c6b-ee91-4b46-b3b2-2c75736772fc/44.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/9fca48f5-bcd7-4e79-8490-edb4c436f4a1/45.png?format=500w"] },
      { name: "Stonewash", hex: "#a8b5c4", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/d08f303f-e454-4e6a-ba6f-5487ae4dc09f/Mens+Pat+Better+Sweater+Jacket.png?format=2500w"] },
      { name: "New Navy", hex: "#1d3461", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/d08f303f-e454-4e6a-ba6f-5487ae4dc09f/Mens+Pat+Better+Sweater+Jacket.png?format=2500w"] },
      { name: "River Rock Green", hex: "#6e8c6a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/d08f303f-e454-4e6a-ba6f-5487ae4dc09f/Mens+Pat+Better+Sweater+Jacket.png?format=2500w"] },
      { name: "Nautilus Tan", hex: "#c9b89d", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/d08f303f-e454-4e6a-ba6f-5487ae4dc09f/Mens+Pat+Better+Sweater+Jacket.png?format=2500w"] },
      { name: "Grayling Brown", hex: "#6b5a4e", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/d08f303f-e454-4e6a-ba6f-5487ae4dc09f/Mens+Pat+Better+Sweater+Jacket.png?format=2500w"] }
    ], 
    sizes: ["S", "M", "L", "XL", "XXL"], 
    minQty: 24,
    description: "Classic Patagonia fleece jacket made with recycled polyester. Warm, durable, and eco-friendly."
  },
  // JAK 004 - Updated colorways per Abigail's email
  { 
    sku: "JAK 004", 
    name: "Patagonia Better Sweater Jacket (Womens)", 
    category: "Jackets", 
    brands: ["Patagonia"], 
    gender: ["Womens"], 
    colours: [
      { name: "Black", hex: "#1a1a1a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/32b587df-74c0-4c7a-96d2-32b7f80a96f2/Womens+Pat+Better+Sweater+Jacket.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/403eba4b-591b-439a-8c20-26847c390605/41.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/920ff120-e173-4db1-8eab-44ee6047c214/42.png?format=500w"] },
      { name: "Birch White", hex: "#f0ede6", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/32b587df-74c0-4c7a-96d2-32b7f80a96f2/Womens+Pat+Better+Sweater+Jacket.png?format=500w"] },
      { name: "New Navy", hex: "#1d3461", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/32b587df-74c0-4c7a-96d2-32b7f80a96f2/Womens+Pat+Better+Sweater+Jacket.png?format=500w"] },
      { name: "River Rock Green", hex: "#6e8c6a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/32b587df-74c0-4c7a-96d2-32b7f80a96f2/Womens+Pat+Better+Sweater+Jacket.png?format=500w"] },
      { name: "Light Violet", hex: "#b28fc0", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/32b587df-74c0-4c7a-96d2-32b7f80a96f2/Womens+Pat+Better+Sweater+Jacket.png?format=500w"] }
    ], 
    sizes: ["XS", "S", "M", "L", "XL"], 
    minQty: 24,
    description: "Women's fit Better Sweater with feminine contours. Warm fleece with smooth exterior."
  },
  { 
    sku: "TEC 001", 
    name: "JBL GO 4", 
    category: "Tech", 
    brands: ["JBL"], 
    gender: ["Unisex"], 
    colours: [
      { name: "White", hex: "#f5f5f5", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/72128c40-7663-4f9c-9a3d-c5c5d619faac/JBL+Go+4.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/90fd89b6-80ea-43c1-b0d6-b993bb9b45e4/14.png?format=500w", "https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/40333492-dab5-4258-9a5a-6b4481809697/15.png?format=2500w"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/72128c40-7663-4f9c-9a3d-c5c5d619faac/JBL+Go+4.png?format=500w"] },
      { name: "Blue", hex: "#4472c4", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/72128c40-7663-4f9c-9a3d-c5c5d619faac/JBL+Go+4.png?format=500w"] },
      { name: "Red", hex: "#c0392b", images: ["https://images.squarespace-cdn.com/content/v1/6996114205ae570d4f1d5401/72128c40-7663-4f9c-9a3d-c5c5d619faac/JBL+Go+4.png?format=500w"] }
    ], 
    sizes: ["One Size"], 
    minQty: 12,
    description: "Ultra-portable Bluetooth speaker with JBL Pro Sound. Waterproof and dustproof for outdoor use."
  },
  // NEW PRODUCTS - Peter Millar
  {
    sku: "TOP 010",
    name: "Peter Millar Raglan Sleeve Perth Layer Quarter-Zip",
    category: "Tops",
    brands: ["Peter Millar"],
    gender: ["Womens"],
    colours: [
      { name: "Navy", hex: "#1b2a4a", images: ["https://www.drivingi.com/images/product/LE0EK43-Navy.jpg"] },
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/LE0EK43-White.jpg"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://www.drivingi.com/images/product/LE0EK43-Black.jpg"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Peter Millar Raglan Sleeve Perth Layer Quarter-Zip sets the standard for clean, classic sport style. Designed with a modern raglan sleeve and refined kissing welt placket, it's finished with a subtle metallic zipper for an elevated touch. Crafted from a four-way stretch performance blend, it offers moisture-wicking, quick-dry comfort and easy care, along with UPF 50+ sun protection. Lightweight and versatile, it's the perfect layering piece for the course, office, or weekend."
  },
  {
    sku: "TOP 011",
    name: "Peter Millar Performance Button Polo",
    category: "Tops",
    brands: ["Peter Millar"],
    gender: ["Womens"],
    colours: [
      { name: "Navy", hex: "#1b2a4a", images: ["https://www.drivingi.com/images/product/PM-ButtonPolo-Navy.jpg"] },
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/PM-ButtonPolo-White.jpg"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://www.drivingi.com/images/product/PM-ButtonPolo-Black.jpg"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Peter Millar Women's Performance Button Polo is crafted from the brand's signature performance fabric for exceptional softness and a fluid, flattering drape. Designed for superior comfort on and off the course, it keeps you cool, polished, and confident throughout the day. Made with four-way stretch and antimicrobial, moisture-wicking, quick-dry technology, it also offers UPF 50+ sun protection and easy-care convenience. Finished with a self-fabric collar, four-button placket, and notched hem, it's a refined essential built for modern performance."
  },
  {
    sku: "TOP 012",
    name: "Peter Millar Banded Sport Mesh Sleeveless Button Polo",
    category: "Tops",
    brands: ["Peter Millar"],
    gender: ["Womens"],
    colours: [
      { name: "Navy", hex: "#1b2a4a", images: ["https://www.drivingi.com/images/product/LE0EK06S-Navy.jpg"] },
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/LE0EK06S-White.jpg"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://www.drivingi.com/images/product/LE0EK06S-Black.jpg"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Peter Millar Banded Sport Mesh Sleeveless Button Polo is a course classic designed for effortless wear long after your round. Crafted from incredibly soft jersey fabric with a fluid drape, it delivers moisture-wicking comfort, odor resistance, and four-way stretch for all-day performance. With UPF 50+ sun protection, it's ideal for extended time outdoors. Finished with a self-fabric collar, four-button placket, and a flattering flared notched hem, this sleeveless polo blends athletic function with polished, feminine style."
  },
  {
    sku: "TOP 013",
    name: "Peter Millar Perth Performance Quarter-Zip",
    category: "Tops",
    brands: ["Peter Millar"],
    gender: ["Mens"],
    colours: [
      { name: "Cottage Blue", hex: "#6b8aa8", images: ["https://www.drivingi.com/images/product/ME0EK40-CottageBlue.jpg"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://www.drivingi.com/images/product/ME0EK40-Black.jpg"] },
      { name: "British Grey", hex: "#8c8c8c", images: ["https://www.drivingi.com/images/product/ME0EK40-BritishGrey.jpg"] },
      { name: "Iron", hex: "#4a4a4a", images: ["https://www.drivingi.com/images/product/ME0EK40-Iron.jpg"] },
      { name: "Navy", hex: "#1b2a4a", images: ["https://www.drivingi.com/images/product/ME0EK40-Navy.jpg"] },
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/ME0EK40-White.jpg"] },
      { name: "Red", hex: "#c0392b", images: ["https://www.drivingi.com/images/product/ME0EK40-Red.jpg"] },
      { name: "Blue", hex: "#4472c4", images: ["https://www.drivingi.com/images/product/ME0EK40-Blue.jpg"] },
      { name: "Green", hex: "#2e7d32", images: ["https://www.drivingi.com/images/product/ME0EK40-Green.jpg"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Peter Millar Perth Performance Quarter-Zip (Men's) is crafted from signature high-tech loop terry fabric that delivers premium comfort with modern performance. Designed with four-way stretch and two-yarn moisture-wicking technology, it dries quickly and provides UPF 50+ sun protection for all-day wear. Styled with a print zipper, mock collar, and banded cuffs and hem, this classic-fit layer offers a polished sport look. Finished with the Peter Millar logo on the back yoke, it's an easy-care essential for the course, office, or weekend."
  },
  // NEW PRODUCTS - Johnnie-O
  {
    sku: "TOP 014",
    name: "Johnnie-O Course Long Sleeve T-Shirt",
    category: "Tops",
    brands: ["Johnnie-O"],
    gender: ["Mens"],
    colours: [
      { name: "Wake", hex: "#1e3a5f", images: ["https://www.drivingi.com/images/product/JMLT2920-Wake.jpg"] },
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/JMLT2920-White.jpg"] },
      { name: "Heather Black", hex: "#3a3a3a", images: ["https://www.drivingi.com/images/product/JMLT2920-HeatherBlack.jpg"] },
      { name: "Seal", hex: "#3d4a4f", images: ["https://www.drivingi.com/images/product/JMLT2920-Seal.jpg"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Johnnie-O Course Long Sleeve T-Shirt is a performance-driven essential designed for active days and everyday comfort. Made from a soft stretch blend of polyester, lyocell, and spandex, this Dri-Release® crew delivers moisture-wicking performance with a lightweight, breathable feel. Finished with contrast neck tape, tonal reverse coverstitch detailing, and a reflective script logo at the back shoulder, it blends athletic function with clean, modern style."
  },
  {
    sku: "TOP 015",
    name: "Johnnie-O Course T-Shirt",
    category: "Tops",
    brands: ["Johnnie-O"],
    gender: ["Mens"],
    colours: [
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/JMST3010-White.jpg"] },
      { name: "Seal", hex: "#3d4a4f", images: ["https://www.drivingi.com/images/product/JMST3010-Seal.jpg"] },
      { name: "Wake", hex: "#1e3a5f", images: ["https://www.drivingi.com/images/product/JMST3010-Wake.jpg"] },
      { name: "Heather Black", hex: "#3a3a3a", images: ["https://www.drivingi.com/images/product/JMST3010-HeatherBlack.jpg"] },
      { name: "Barrels Blue", hex: "#5b8eb5", images: ["https://www.drivingi.com/images/product/JMST3010-BarrelsBlue.jpg"] },
      { name: "Malibu", hex: "#f5a623", images: ["https://www.drivingi.com/images/product/JMST3010-Malibu.jpg"] },
      { name: "Rouge Red", hex: "#a32638", images: ["https://www.drivingi.com/images/product/JMST3010-RougeRed.jpg"] },
      { name: "Thunder", hex: "#5c5c5c", images: ["https://www.drivingi.com/images/product/JMST3010-Thunder.jpg"] },
      { name: "Lobster", hex: "#e74c3c", images: ["https://www.drivingi.com/images/product/JMST3010-Lobster.jpg"] }
    ],
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Johnnie-O Course T-Shirt is a lightweight performance essential built for movement and everyday wear. Crafted from a soft stretch blend of polyester, lyocell, and spandex, this Dri-Release® crew neck tee delivers moisture-wicking comfort with a smooth, breathable feel. Designed with contrast neck tape, tonal reverse coverstitch detailing, and a reflective script logo at the back shoulder, it offers a clean, athletic look with subtle performance-driven touches."
  },
  // NEW PRODUCTS - Helly Hansen
  {
    sku: "JAK 005",
    name: "Helly Hansen Crew Insulator 2.0 Jacket (Womens)",
    category: "Jackets",
    brands: ["Helly Hansen"],
    gender: ["Womens"],
    colours: [
      { name: "White", hex: "#ffffff", images: ["https://www.drivingi.com/images/product/30239-White.jpg"] },
      { name: "Navy", hex: "#1b2a4a", images: ["https://www.drivingi.com/images/product/30239-Navy.jpg"] },
      { name: "Ultra Blue", hex: "#0066cc", images: ["https://www.drivingi.com/images/product/30239-UltraBlue.jpg"] },
      { name: "Magenta 2.0", hex: "#c2185b", images: ["https://www.drivingi.com/images/product/30239-Magenta.jpg"] }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Helly Hansen Women's Crew Insulator Jacket 2.0 delivers lightweight warmth with a clean, marine-inspired design that transitions effortlessly from the water to the city. Insulated with 80% recycled PrimaLoft® Black, it provides reliable comfort while maintaining a streamlined silhouette. Constructed with a PFC-free, water-repellent microfiber shell, it helps keep you dry in changing conditions. Soft, comfortable, and versatile, this classic crew layer blends sustainable insulation with everyday performance."
  },
  {
    sku: "JAK 006",
    name: "Helly Hansen Crew Insulator 2.0 Jacket (Mens)",
    category: "Jackets",
    brands: ["Helly Hansen"],
    gender: ["Mens"],
    colours: [
      { name: "Ebony", hex: "#2b2b2b", images: ["https://www.drivingi.com/images/product/30343-Ebony.jpg"] },
      { name: "Red", hex: "#c0392b", images: ["https://www.drivingi.com/images/product/30343-Red.jpg"] },
      { name: "Navy", hex: "#1b2a4a", images: ["https://www.drivingi.com/images/product/30343-Navy.jpg"] },
      { name: "Black", hex: "#1a1a1a", images: ["https://www.drivingi.com/images/product/30343-Black.jpg"] },
      { name: "Washed Navy", hex: "#4a6178", images: ["https://www.drivingi.com/images/product/30343-WashedNavy.jpg"] }
    ],
    sizes: ["S", "M", "L", "XL", "XXL"],
    minQty: 12,
    description: "The Helly Hansen Crew Insulator Jacket is a lightweight, versatile layer designed to keep you warm on the water and polished in the city. Featuring 80% recycled PrimaLoft® Black insulation, it delivers reliable warmth without added bulk. Constructed with a PFC-free, water-repellent microfiber shell, it helps protect against light moisture while maintaining a clean, classic marine look. Soft, comfortable, and easy to wear, this insulated jacket blends sustainable materials with everyday performance."
  }
]

// Helpers (getCategories/getBrands/getGenders) live in lib/products.ts.
// This file is pure seed data — keep it free of logic so the seed script
// and fallback layer can import it with zero side effects.
