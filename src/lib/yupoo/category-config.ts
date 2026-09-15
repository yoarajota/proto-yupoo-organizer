export type CanonicalBrand = {
  canonical: string
  display: string
  aliases: string[]
  embeddingTerms: string[]
}

export type CanonicalProduct = {
  canonical: string
  display: string
  aliases: string[]
}

export const CANONICAL_BRANDS: CanonicalBrand[] = [
  {
    canonical: 'lv',
    display: 'LV',
    aliases: ['lv', 'l v', 'l.v', 'louie vuitton'],
    embeddingTerms: ['louis vuitton', 'loui vuiton', 'louisvuitton'],
  },
  {
    canonical: 'gucci',
    display: 'Gucci',
    aliases: ['gucci', 'gcci', 'g u c c i'],
    embeddingTerms: ['gucci'],
  },
  {
    canonical: 'dior',
    display: 'Dior',
    aliases: ['dior', 'd i o r'],
    embeddingTerms: ['christian dior', 'dior'],
  },
  {
    canonical: 'prada',
    display: 'Prada',
    aliases: ['prada', 'p r a d a'],
    embeddingTerms: ['prada'],
  },
  {
    canonical: 'chanel',
    display: 'Chanel',
    aliases: ['chanel', 'c h a n e l'],
    embeddingTerms: ['chanel'],
  },
  {
    canonical: 'nike',
    display: 'Nike',
    aliases: ['nike', 'n i k e'],
    embeddingTerms: ['nike'],
  },
  {
    canonical: 'jordan',
    display: 'Jordan',
    aliases: ['jordan', 'air jordan', 'a j', 'AJ1'],
    embeddingTerms: ['jordan', 'air jordan'],
  },
  {
    canonical: 'adidas',
    display: 'Adidas',
    aliases: ['adidas', 'a d i d a s'],
    embeddingTerms: ['adidas'],
  },
  {
    canonical: 'balenciaga',
    display: 'Balenciaga',
    aliases: ['balenciaga', 'b a l e n c i a g a'],
    embeddingTerms: ['balenciaga'],
  },
]

export const CANONICAL_PRODUCTS: CanonicalProduct[] = [
  { canonical: 'bags', display: 'Bags', aliases: ['bags', 'bag', 'b4g$', 'b4gs', 'handbags'] },
  { canonical: 'shoes', display: 'Shoes', aliases: ['shoes', 'shoe', 'heels'] },
  { canonical: 'sneakers', display: 'Sneakers', aliases: ['sneakers', 'sneaker', 'trainers'] },
  { canonical: 'wallets', display: 'Wallets', aliases: ['wallets', 'wallet', 'slg', 'small leather goods'] },
  { canonical: 'belts', display: 'Belts', aliases: ['belts', 'belt'] },
  { canonical: 'clothing', display: 'Clothing', aliases: ['clothing', 'apparel', 'ready to wear', 'rtw'] },
  { canonical: 'watches', display: 'Watches', aliases: ['watches', 'watch', 'timepieces'] },
  { canonical: 'jewelry', display: 'Jewelry', aliases: ['jewelry', 'jewellery', 'accessories'] },
]
