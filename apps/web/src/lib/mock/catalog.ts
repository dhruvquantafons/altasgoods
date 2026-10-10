import type { Brand, Category, Offer, Product, ProductSpec, VariantOption } from "../types";
import type { ListingStatus } from "../status";
import { between, NOW, addDays, seeded, slugify } from "../utils";

/* ----------------------------- Categories ----------------------------- */

const tree: [slug: string, name: string, icon: string, commission: number, image: string, subs: string[]][] = [
  ["mobiles", "Mobiles & Tablets", "Smartphone", 4, "phone-aurora", ["Smartphones", "Tablets", "Mobile Accessories", "Power Banks"]],
  ["electronics", "Electronics", "Laptop", 8, "laptop-air", ["Laptops", "Headphones", "Speakers", "Wearables", "Cameras", "Monitors", "Computer Accessories"]],
  ["fashion", "Fashion", "Shirt", 6, "jacket-denim", ["Men's Clothing", "Women's Clothing", "Ethnic Wear", "Footwear", "Bags", "Watches", "Eyewear"]],
  ["home", "Home & Furniture", "Sofa", 10, "sofa-oslo", ["Furniture", "Lighting", "Home Decor", "Furnishing", "Cookware", "Kitchen and Dining"]],
  ["appliances", "Appliances", "Refrigerator", 8, "airfryer-crisp", ["Kitchen Appliances", "Large Appliances", "Air Conditioners", "Washing Machines"]],
  ["beauty", "Beauty", "Sparkles", 10, "serum-glow", ["Skincare", "Fragrance", "Makeup", "Haircare"]],
  ["grocery", "Grocery", "ShoppingBasket", 5, "coffee-beans", ["Coffee and Tea", "Dry Fruits", "Cooking Essentials", "Snacks"]],
  ["books", "Books", "BookOpen", 8, "books-stack", ["Fiction", "Collections", "Non-fiction", "Children's Books"]],
  ["sports", "Sports & Fitness", "Dumbbell", 9, "yoga-mat", ["Yoga", "Strength Training", "Cricket", "Cycling"]],
  ["toys", "Toys & Baby", "Puzzle", 9, "toys-wooden", ["Learning Toys", "Soft Toys", "Baby Care"]],
];

export const categories: Category[] = tree.map(([slug, name, icon, commission, image, subs]) => ({
  id: `cat-${slug}`,
  slug,
  name,
  icon,
  commission,
  image: `/images/products/${image}.jpg`,
  children: subs.map((s) => ({
    id: `cat-${slug}-${slugify(s)}`,
    slug: slugify(s),
    name: s,
    parentId: `cat-${slug}`,
    icon,
    commission,
  })),
}));

export function getCategory(idOrSlug: string) {
  return categories.find((c) => c.id === idOrSlug || c.slug === idOrSlug);
}

/* ------------------------------- Brands ------------------------------- */

const brandNames = [
  "Novatek", "Kestrel", "Auralis", "Pulse", "Orbit", "Lumora", "Keystone",
  "Linen & Loom", "Northbound", "Rangrez", "Stride", "Maison Vara", "Meridian", "Solace",
  "Oaken", "Terra Home", "Kiln & Co", "Hearth", "Brewline", "Voltix",
  "Veda Naturals", "Noir Atelier", "Rouge Studio", "Dermalab",
  "Estate Roasters", "Assam Gold", "Harvest Basket", "Oliva Grove",
  "Penrose Press", "Asana", "Kinetic", "Willow Works", "Ridewell", "Little Oak", "Cuddle Co",
] as const;

export const brands: Brand[] = brandNames.map((name, i) => ({
  id: `br-${slugify(name)}`,
  name,
  slug: slugify(name),
  verified: i % 5 !== 3,
}));

export function getBrand(id: string) {
  return brands.find((b) => b.id === id || b.slug === id);
}

/* ------------------------------ Products ------------------------------ */

type Seed = {
  key: string;
  title: string;
  brand: (typeof brandNames)[number];
  cat: string;
  sub: string;
  price: number;
  mrp: number;
  rating: number;
  count: number;
  tags?: Product["tags"];
  sellers: string[];
};

const seeds: Seed[] = [
  { key: "phone-aurora", title: "Novatek Aurora 5G (Graphite, 256 GB) 12 GB RAM", brand: "Novatek", cat: "mobiles", sub: "Smartphones", price: 54999, mrp: 64999, rating: 4.5, count: 18234, tags: ["bestseller"], sellers: ["s-novatek", "s-apex", "s-urbankart"] },
  { key: "phone-nova", title: "Novatek Nova Lite 5G (Rose Pink, 128 GB) 8 GB RAM", brand: "Novatek", cat: "mobiles", sub: "Smartphones", price: 17999, mrp: 21999, rating: 4.3, count: 42310, tags: ["deal"], sellers: ["s-novatek", "s-urbankart"] },
  { key: "tablet-slate", title: "Novatek Slate 11 Tablet, 11 inch 2.5K Display, Wi-Fi, 128 GB", brand: "Novatek", cat: "mobiles", sub: "Tablets", price: 24999, mrp: 32999, rating: 4.4, count: 6120, sellers: ["s-novatek", "s-apex"] },
  { key: "laptop-air", title: "Kestrel Air 14 Thin and Light Laptop (Core Ultra 7, 16 GB, 1 TB SSD)", brand: "Kestrel", cat: "electronics", sub: "Laptops", price: 84990, mrp: 104990, rating: 4.6, count: 3210, tags: ["new"], sellers: ["s-apex", "s-urbankart"] },
  { key: "laptop-pro", title: "Kestrel Pro 16 Creator Laptop (Ryzen 9, 32 GB, RTX 5060)", brand: "Kestrel", cat: "electronics", sub: "Laptops", price: 149990, mrp: 179990, rating: 4.5, count: 1290, sellers: ["s-apex"] },
  { key: "headphones-studio", title: "Auralis Studio ANC Wireless Over-Ear Headphones", brand: "Auralis", cat: "electronics", sub: "Headphones", price: 12999, mrp: 19990, rating: 4.5, count: 22100, tags: ["bestseller", "deal"], sellers: ["s-apex", "s-urbankart", "s-ganesh"] },
  { key: "earbuds-pods", title: "Auralis Pods Pro True Wireless Earbuds with ANC", brand: "Auralis", cat: "electronics", sub: "Headphones", price: 4999, mrp: 8999, rating: 4.2, count: 58700, tags: ["deal"], sellers: ["s-apex", "s-urbankart"] },
  { key: "speaker-boom", title: "Pulse Boom 2 Portable Bluetooth Speaker, IP67 Waterproof", brand: "Pulse", cat: "electronics", sub: "Speakers", price: 3499, mrp: 5999, rating: 4.3, count: 15300, sellers: ["s-apex", "s-ganesh"] },
  { key: "watch-smart", title: "Orbit Watch S3 AMOLED Smartwatch with GPS and SpO2", brand: "Orbit", cat: "electronics", sub: "Wearables", price: 7999, mrp: 12999, rating: 4.1, count: 21900, tags: ["deal"], sellers: ["s-urbankart", "s-apex"] },
  { key: "camera-mirrorless", title: "Lumora Z50 Mirrorless Camera with 18-55 mm Lens", brand: "Lumora", cat: "electronics", sub: "Cameras", price: 68990, mrp: 79990, rating: 4.7, count: 1840, sellers: ["s-apex"] },
  { key: "monitor-ultra", title: "Lumora 27 inch 4K IPS Monitor, 144 Hz, USB-C", brand: "Lumora", cat: "electronics", sub: "Monitors", price: 27999, mrp: 36999, rating: 4.4, count: 2870, sellers: ["s-apex", "s-urbankart"] },
  { key: "keyboard-mech", title: "Keystone K2 Wireless Mechanical Keyboard, Hot-swappable", brand: "Keystone", cat: "electronics", sub: "Computer Accessories", price: 6499, mrp: 8499, rating: 4.5, count: 5420, sellers: ["s-urbankart"] },

  { key: "tee-classic", title: "Linen & Loom Men's Supima Cotton Crew Neck T-Shirt", brand: "Linen & Loom", cat: "fashion", sub: "Men's Clothing", price: 799, mrp: 1499, rating: 4.3, count: 12800, tags: ["bestseller"], sellers: ["s-loomhouse"] },
  { key: "jacket-denim", title: "Northbound Men's Washed Denim Trucker Jacket", brand: "Northbound", cat: "fashion", sub: "Men's Clothing", price: 2499, mrp: 4299, rating: 4.2, count: 3400, sellers: ["s-loomhouse", "s-urbankart"] },
  { key: "dress-summer", title: "Linen & Loom Women's Floral Lace Midi Dress, Ivory", brand: "Linen & Loom", cat: "fashion", sub: "Women's Clothing", price: 1999, mrp: 3499, rating: 4.4, count: 2210, tags: ["new"], sellers: ["s-loomhouse"] },
  { key: "kurta-ethnic", title: "Rangrez Women's Block Print Cotton Kurta, Crimson", brand: "Rangrez", cat: "fashion", sub: "Ethnic Wear", price: 1599, mrp: 2999, rating: 4.3, count: 7800, tags: ["deal"], sellers: ["s-loomhouse"] },
  { key: "sneakers-white", title: "Stride Court Classic Leather Sneakers", brand: "Stride", cat: "fashion", sub: "Footwear", price: 2999, mrp: 4999, rating: 4.4, count: 9800, tags: ["bestseller"], sellers: ["s-loomhouse", "s-profit"] },
  { key: "shoes-running", title: "Stride Velocity Cushioned Running Shoes", brand: "Stride", cat: "fashion", sub: "Footwear", price: 3999, mrp: 6499, rating: 4.5, count: 6400, sellers: ["s-profit"] },
  { key: "bag-leather", title: "Maison Vara Full Grain Leather Tote Bag", brand: "Maison Vara", cat: "fashion", sub: "Bags", price: 4499, mrp: 7999, rating: 4.6, count: 1980, tags: [], sellers: ["s-loomhouse"] },
  { key: "watch-analog", title: "Meridian Heritage Automatic Analog Watch, 40 mm", brand: "Meridian", cat: "fashion", sub: "Watches", price: 8999, mrp: 14999, rating: 4.5, count: 2650, sellers: ["s-urbankart"] },
  { key: "sunglasses-aviator", title: "Solace Polarised Aviator Sunglasses with UV400", brand: "Solace", cat: "fashion", sub: "Eyewear", price: 1899, mrp: 3499, rating: 4.2, count: 5100, sellers: ["s-urbankart"] },
  { key: "backpack-urban", title: "Northbound Urban 25 L Laptop Backpack, Water Resistant", brand: "Northbound", cat: "fashion", sub: "Bags", price: 1799, mrp: 3299, rating: 4.4, count: 11200, tags: ["deal"], sellers: ["s-urbankart", "s-apex"] },

  { key: "sofa-oslo", title: "Oaken Oslo 3 Seater Fabric Sofa, Ash Grey", brand: "Oaken", cat: "home", sub: "Furniture", price: 32999, mrp: 54999, rating: 4.3, count: 860, sellers: ["s-terra"] },
  { key: "chair-lounge", title: "Oaken Haven Accent Lounge Chair, Solid Wood Frame", brand: "Oaken", cat: "home", sub: "Furniture", price: 12999, mrp: 19999, rating: 4.4, count: 540, tags: ["new"], sellers: ["s-terra"] },
  { key: "lamp-arc", title: "Terra Home Arc Table Lamp with Linen Shade", brand: "Terra Home", cat: "home", sub: "Lighting", price: 2299, mrp: 3999, rating: 4.5, count: 1730, sellers: ["s-terra", "s-kiln"] },
  { key: "vase-ceramic", title: "Kiln & Co Handcrafted Ceramic Vase, Set of 2", brand: "Kiln & Co", cat: "home", sub: "Home Decor", price: 1299, mrp: 2199, rating: 4.6, count: 2380, sellers: ["s-kiln"] },
  { key: "cushions-linen", title: "Terra Home Washed Linen Cushion Covers, Set of 4", brand: "Terra Home", cat: "home", sub: "Furnishing", price: 999, mrp: 1799, rating: 4.3, count: 4410, sellers: ["s-terra"] },
  { key: "cookware-pan", title: "Hearth Tri-Ply Stainless Steel Frying Pan, 26 cm", brand: "Hearth", cat: "home", sub: "Cookware", price: 2199, mrp: 3499, rating: 4.5, count: 6700, sellers: ["s-apex", "s-terra"] },
  { key: "coffee-maker", title: "Brewline Pour Over Coffee Maker Set with Glass Carafe", brand: "Brewline", cat: "home", sub: "Kitchen and Dining", price: 1899, mrp: 2999, rating: 4.4, count: 1290, sellers: ["s-kiln"] },
  { key: "mugs-stone", title: "Kiln & Co Stoneware Coffee Mugs, Set of 4", brand: "Kiln & Co", cat: "home", sub: "Kitchen and Dining", price: 899, mrp: 1499, rating: 4.5, count: 3880, sellers: ["s-kiln"] },

  { key: "airfryer-crisp", title: "Voltix Crisp 12 L Oven Toaster Grill, Retro Finish", brand: "Voltix", cat: "appliances", sub: "Kitchen Appliances", price: 5999, mrp: 9999, rating: 4.4, count: 31200, tags: ["bestseller", "deal"], sellers: ["s-apex", "s-ganesh"] },
  { key: "blender-pro", title: "Voltix ProBlend 1000 W Mixer Grinder with 3 Jars", brand: "Voltix", cat: "appliances", sub: "Kitchen Appliances", price: 3499, mrp: 5999, rating: 4.3, count: 18700, sellers: ["s-ganesh", "s-apex"] },

  { key: "serum-glow", title: "Veda Naturals 10% Niacinamide Glow Serum, 30 ml", brand: "Veda Naturals", cat: "beauty", sub: "Skincare", price: 549, mrp: 799, rating: 4.3, count: 25400, tags: ["bestseller"], sellers: ["s-glow"] },
  { key: "perfume-noir", title: "Noir Atelier Oud Intense Eau de Parfum, 100 ml", brand: "Noir Atelier", cat: "beauty", sub: "Fragrance", price: 2799, mrp: 4500, rating: 4.4, count: 3200, tags: [], sellers: ["s-glow"] },
  { key: "lipstick-velvet", title: "Rouge Studio Velvet Matte Lipstick, Rosewood", brand: "Rouge Studio", cat: "beauty", sub: "Makeup", price: 499, mrp: 899, rating: 4.2, count: 9800, sellers: ["s-glow"] },
  { key: "cream-hydra", title: "Dermalab Hydra Ceramide Daily Moisturiser, 50 g", brand: "Dermalab", cat: "beauty", sub: "Skincare", price: 649, mrp: 899, rating: 4.5, count: 14300, sellers: ["s-glow", "s-greenleaf"] },

  { key: "coffee-beans", title: "Estate Roasters Chikmagalur Medium Roast Coffee Beans, 500 g", brand: "Estate Roasters", cat: "grocery", sub: "Coffee and Tea", price: 699, mrp: 850, rating: 4.6, count: 4300, sellers: ["s-greenleaf"] },
  { key: "tea-assam", title: "Assam Gold Second Flush Loose Leaf Tea, 250 g", brand: "Assam Gold", cat: "grocery", sub: "Coffee and Tea", price: 399, mrp: 550, rating: 4.5, count: 7200, sellers: ["s-greenleaf"] },
  { key: "almonds-premium", title: "Harvest Basket Premium California Almonds, 1 kg", brand: "Harvest Basket", cat: "grocery", sub: "Dry Fruits", price: 949, mrp: 1299, rating: 4.4, count: 22000, tags: ["deal"], sellers: ["s-greenleaf", "s-ganesh"] },
  { key: "oil-olive", title: "Oliva Grove Cold Pressed Extra Virgin Olive Oil, 1 L", brand: "Oliva Grove", cat: "grocery", sub: "Cooking Essentials", price: 899, mrp: 1250, rating: 4.4, count: 5600, sellers: ["s-greenleaf"] },

  { key: "books-stack", title: "The Classics Collection, Boxed Set of 6 Hardcovers", brand: "Penrose Press", cat: "books", sub: "Collections", price: 1999, mrp: 3499, rating: 4.7, count: 1240, sellers: ["s-pageturn"] },
  { key: "book-novel", title: "The Monsoon Archive: A Novel (Hardcover)", brand: "Penrose Press", cat: "books", sub: "Fiction", price: 449, mrp: 699, rating: 4.5, count: 8900, tags: ["new"], sellers: ["s-pageturn"] },

  { key: "yoga-mat", title: "Asana Pro 6 mm Non-Slip Yoga Mat with Carry Strap", brand: "Asana", cat: "sports", sub: "Yoga", price: 1299, mrp: 2199, rating: 4.4, count: 13400, sellers: ["s-profit"] },
  { key: "dumbbells-hex", title: "Kinetic Rubber Coated Hex Dumbbells, 2 x 5 kg", brand: "Kinetic", cat: "sports", sub: "Strength Training", price: 2499, mrp: 3999, rating: 4.5, count: 4500, sellers: ["s-profit"] },
  { key: "cricket-bat", title: "Willow Works Match Grade Leather Cricket Ball, Pack of 2", brand: "Willow Works", cat: "sports", sub: "Cricket", price: 899, mrp: 1299, rating: 4.6, count: 1100, sellers: ["s-profit"] },
  { key: "bicycle-city", title: "Ridewell Metro 7 Speed City Bicycle, 700C", brand: "Ridewell", cat: "sports", sub: "Cycling", price: 14999, mrp: 21999, rating: 4.3, count: 980, sellers: ["s-profit"] },

  { key: "toys-wooden", title: "Little Oak Wooden Stacking Blocks, 40 Pieces", brand: "Little Oak", cat: "toys", sub: "Learning Toys", price: 1199, mrp: 1999, rating: 4.7, count: 3100, sellers: ["s-tinytots"] },
  { key: "teddy-bear", title: "Cuddle Co Classic Plush Teddy Bear, 45 cm", brand: "Cuddle Co", cat: "toys", sub: "Soft Toys", price: 899, mrp: 1499, rating: 4.6, count: 6200, sellers: ["s-tinytots"] },
];

const highlightsByCat: Record<string, string[]> = {
  mobiles: ["6.7 inch 120 Hz AMOLED display", "50 MP OIS main camera with 4K video", "5000 mAh battery with 67 W fast charging", "Octa-core 4 nm processor", "4 years of OS updates"],
  electronics: ["Premium build with 1 year brand warranty", "Low latency Bluetooth 5.4", "Fast charging over USB-C", "Works with Android and iOS", "Made for everyday performance"],
  fashion: ["Premium fabric that stays soft wash after wash", "Regular fit, true to size", "Machine wash cold", "Designed in India", "Easy 10 day returns and exchange"],
  home: ["Crafted from sustainably sourced materials", "Easy to clean and maintain", "Free installation in select cities", "1 year warranty against manufacturing defects"],
  appliances: ["Energy efficient with auto shut-off", "2 year comprehensive warranty", "Overload protection", "Includes recipe booklet"],
  beauty: ["Dermatologically tested", "Suitable for all skin types", "Fragrance free and non-comedogenic", "Cruelty free"],
  grocery: ["Sourced directly from estates and farms", "No added preservatives", "Freshly packed in resealable pouch", "FSSAI certified"],
  books: ["Hardcover with ribbon marker", "Printed on acid-free paper", "Original unabridged text"],
  sports: ["Built for daily training", "Sweat and slip resistant", "Lightweight and durable", "6 month warranty"],
  toys: ["Non-toxic, child safe finishes", "Builds motor and cognitive skills", "BIS certified", "Suitable for ages 1 and above"],
};

function specsFor(s: Seed): ProductSpec[] {
  const general: ProductSpec = {
    group: "General",
    items: [
      { label: "Brand", value: s.brand },
      { label: "Model name", value: s.title.split(/[,(]/)[0]!.replace(s.brand, "").trim() },
      { label: "Category", value: s.sub },
      { label: "Country of origin", value: "India" },
    ],
  };
  const byCat: Record<string, ProductSpec> = {
    mobiles: { group: "Display and performance", items: [{ label: "Display", value: "6.7 inch AMOLED, 120 Hz" }, { label: "Processor", value: "Octa-core 3.2 GHz" }, { label: "RAM", value: "8 GB / 12 GB" }, { label: "Battery", value: "5000 mAh" }] },
    electronics: { group: "Technical", items: [{ label: "Connectivity", value: "Bluetooth 5.4, USB-C" }, { label: "Battery life", value: "Up to 40 hours" }, { label: "Warranty", value: "1 year manufacturer" }] },
    fashion: { group: "Fabric and fit", items: [{ label: "Material", value: "Premium cotton blend" }, { label: "Fit", value: "Regular" }, { label: "Care", value: "Machine wash" }] },
    home: { group: "Dimensions", items: [{ label: "Material", value: "Solid wood, linen, ceramic" }, { label: "Assembly", value: "Required, free in select cities" }, { label: "Warranty", value: "1 year" }] },
    appliances: { group: "Power", items: [{ label: "Wattage", value: "1000 to 1700 W" }, { label: "Voltage", value: "230 V" }, { label: "Warranty", value: "2 years" }] },
    beauty: { group: "Usage", items: [{ label: "Skin type", value: "All" }, { label: "Shelf life", value: "24 months" }] },
    grocery: { group: "Nutrition", items: [{ label: "Shelf life", value: "9 months" }, { label: "Diet type", value: "Vegetarian" }] },
    books: { group: "Book details", items: [{ label: "Format", value: "Hardcover" }, { label: "Language", value: "English" }, { label: "Publisher", value: "Penrose Press" }] },
    sports: { group: "Product details", items: [{ label: "Material", value: "High density rubber, TPE" }, { label: "Warranty", value: "6 months" }] },
    toys: { group: "Product details", items: [{ label: "Age", value: "12 months and up" }, { label: "Material", value: "Natural wood, plush" }] },
  };
  return [general, byCat[s.cat]!];
}

function variantsFor(s: Seed): VariantOption[] {
  if (s.cat === "mobiles")
    return [
      { name: "Colour", values: [{ label: "Graphite", swatch: "#2b2d31", available: true }, { label: "Rose Pink", swatch: "#e7b7c3", available: true }, { label: "Porcelain", swatch: "#ece8e1", available: false }] },
      { name: "Storage", values: [{ label: "128 GB", available: true }, { label: "256 GB", available: true }, { label: "512 GB", available: true }] },
    ];
  if (s.cat === "fashion" && !["Bags", "Watches", "Eyewear"].includes(s.sub))
    return [
      { name: "Size", values: ["XS", "S", "M", "L", "XL", "XXL"].map((v, i) => ({ label: s.sub === "Footwear" ? `UK ${i + 5}` : v, available: i !== 0 })) },
      { name: "Colour", values: [{ label: "Natural", swatch: "#e9e2d4", available: true }, { label: "Indigo", swatch: "#2f3b63", available: true }, { label: "Olive", swatch: "#6b6b47", available: true }] },
    ];
  if (["Headphones", "Wearables", "Speakers"].includes(s.sub))
    return [{ name: "Colour", values: [{ label: "Graphite", swatch: "#2b2d31", available: true }, { label: "Silver", swatch: "#cfd3d8", available: true }, { label: "Ocean", swatch: "#2a5c8a", available: true }] }];
  return [];
}

function offersFor(s: Seed, rand: () => number): Offer[] {
  return s.sellers.map((sellerId, i) => {
    const bump = i === 0 ? 0 : Math.round(s.price * (0.01 + rand() * 0.06));
    return {
      sellerId,
      price: s.price + bump,
      mrp: s.mrp,
      stock: between(rand, 0, 9) === 0 ? 0 : between(rand, 4, 420),
      fulfilledBy: i === 0 || rand() > 0.5 ? "blubuy" : "seller",
      deliveryDays: i === 0 ? between(rand, 1, 3) : between(rand, 3, 6),
      codAvailable: s.price < 60000,
      returnWindowDays: s.cat === "grocery" ? 0 : s.cat === "fashion" ? 10 : 7,
    };
  });
}

const statusCycle: ListingStatus[] = ["live", "live", "live", "live", "live", "live", "live", "out_of_stock", "live", "live", "suppressed", "live"];

export const products: Product[] = seeds.map((s, i) => {
  const rand = seeded(1000 + i);
  const offers = offersFor(s, rand);
  const stock = offers.reduce((a, o) => a + o.stock, 0);
  const image = `/images/products/${s.key}.jpg`;
  return {
    id: `p-${s.key}`,
    slug: s.key,
    sku: `BB-${s.cat.slice(0, 3).toUpperCase()}-${String(1040 + i * 7).padStart(5, "0")}`,
    title: s.title,
    brandId: `br-${slugify(s.brand)}`,
    brandName: s.brand,
    brandSlug: slugify(s.brand),
    categoryId: `cat-${s.cat}`,
    categoryName: tree.find((c) => c[0] === s.cat)?.[1] ?? s.cat,
    categorySlug: s.cat,
    subcategory: s.sub,
    image,
    gallery: [image, image, image, image],
    price: s.price,
    mrp: s.mrp,
    rating: s.rating,
    ratingCount: s.count,
    reviewCount: Math.round(s.count * 0.18),
    highlights: highlightsByCat[s.cat]!,
    description: `${s.title.split(/[,(]/)[0]!.trim()} is designed for people who care about quality and value. Thoughtfully made by ${s.brand} and backed by AltasGoods Assured quality checks, it is delivered with easy returns and secure payments.`,
    specs: specsFor(s),
    variants: variantsFor(s),
    offers,
    featuredSellerId: s.sellers[0]!,
    assured: s.rating >= 4.3,
    tags: s.tags ?? [],
    stock,
    soldLast30d: Math.round(s.count * (0.03 + rand() * 0.05)),
    listingStatus: stock === 0 ? "out_of_stock" : statusCycle[i % statusCycle.length]!,
    createdAt: addDays(NOW, -between(rand, 20, 600)).toISOString(),
  };
});

export function getProduct(idOrSlug: string) {
  return products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

export function productsByCategory(categorySlug: string) {
  return products.filter((p) => p.categoryId === `cat-${categorySlug}`);
}

export function productsBySeller(sellerId: string) {
  return products.filter((p) => p.offers.some((o) => o.sellerId === sellerId));
}

/** Simple search over title, brand and category for the storefront search page. */
export function searchProducts(q: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return products;
  return products.filter((p) => {
    const hay = `${p.title} ${getBrand(p.brandId)?.name} ${p.subcategory} ${getCategory(p.categoryId)?.name}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
