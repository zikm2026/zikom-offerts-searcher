export function createEmailAnalysisPrompt(emailContent: string): string {
  return `
Przeanalizuj poniższy email i określ, czy jest to oferta handlowa dotycząca laptopów/komputerów.

ZADANIE:
Sprawdź czy email zawiera ofertę sprzedaży laptopów, komputerów, lub powiązanego sprzętu komputerowego.

KRYTERIA OCENY:
- Czy email zawiera informacje o produktach komputerowych (laptopy, PC, komponenty)?
- Czy zawiera ceny, promocje, rabaty?
- Czy pochodzi od sklepu/sprzedawcy?
- Czy zachęca do zakupu?

WAŻNE – uznaj za OFERTĘ (isOffer: true), gdy:
- W temacie jest "OFFER", "NTB" (notebook), "laptop", "notebook", lub data oferty
- W treści jest "find attached our offer", "please find attached", "attached our current offer"
- W treści jest cena w EUR (np. "23 668,00 €") lub liczba + laptop (np. "136x HP Laptop Mix")
- Nawet jeśli dużo tekstu to stopka (Contact, Unsubscribe) – szukaj oferty w pierwszych liniach. Lepiej zaliczyć wątpliwy mail jako ofertę niż go pominąć.

ODPOWIEDZ W FORMACIE JSON:
{
  "isOffer": true/false,
  "confidence": 0-100,
  "category": "laptop" | "desktop" | "components" | "accessories" | "other" | null,
  "details": {
    "productType": "typ produktu lub null",
    "brand": "marka lub null", 
    "model": "model lub null",
    "price": "cena lub null",
    "discount": "rabat/promocja lub null",
    "store": "nazwa sklepu lub null"
  },
  "reasoning": "krótkie uzasadnienie decyzji"
}

EMAIL DO ANALIZY:
${emailContent}

ODPOWIEDŹ (tylko JSON):`;
}
