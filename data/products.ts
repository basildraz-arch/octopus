export type Product = {
  id: number;
  name: string;
  price: number;
  unit: string;
  sellBy: ("money" | "weight")[];
  keywords: string[];
};

export const products: Product[] = [
  {
    id: 1,
    name: "Royal Canin Maxi",
    price: 250,
    unit: "كيلو",
    sellBy: ["money", "weight"],
    keywords: [
      "royal",
      "canin",
      "maxi",
      "roy",
      "رويال",
      "كاني",
      "ماكسي",
      "كلب",
      "dogs",
      "dog",
      "large",
      "اكل كلاب",
    ],
  },

  {
    id: 2,
    name: "Royal Canin Mini",
    price: 230,
    unit: "كيلو",
    sellBy: ["money", "weight"],
    keywords: [
      "royal",
      "canin",
      "mini",
      "roy",
      "رويال",
      "كاني",
      "ميني",
      "كلب",
      "dogs",
      "dog",
      "small",
      "اكل كلاب",
    ],
  },

  {
    id: 3,
    name: "Whiskas",
    price: 180,
    unit: "كيس",
    sellBy: ["money"],
    keywords: [
      "whiskas",
      "ويسكاس",
      "قطط",
      "قط",
      "cat",
      "cats",
      "اكل قطط",
    ],
  },

  {
    id: 4,
    name: "رمل قطط",
    price: 120,
    unit: "كيس",
    sellBy: ["money"],
    keywords: [
      "رمل",
      "قطط",
      "cat",
      "litter",
      "sandbox",
    ],
  },

  {
    id: 5,
    name: "بذور عصافير",
    price: 35,
    unit: "كيلو",
    sellBy: ["money", "weight"],
    keywords: [
      "بذور",
      "عصافير",
      "طيور",
      "bird",
      "birds",
      "seed",
    ],
  },
];