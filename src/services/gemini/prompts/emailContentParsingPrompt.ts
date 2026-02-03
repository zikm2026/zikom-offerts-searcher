export function createEmailContentParsingPrompt(emailContent: string): string {
  return `Jesteś ekspertem w analizie ofert laptopów w treści maili.

Otrzymujesz treść maila z ofertą laptopów.

TWOJE ZADANIE:
1. Przeanalizuj treść maila
2. Znajdź WSZYSTKIE laptopy w ofercie (nawet jeśli jest tylko JEDEN laptop)
3. Dla każdego laptopa wyciągnij:
   - model (nazwa laptopa, np. "Lenovo ThinkPad T14 G2", "EliteBook 845 G8", "Surface Laptop")
   - ram (pamięć RAM, np. "8 GB", "16 GB", "32 GB")
   - storage (dysk, np. "256 GB", "512 GB", "1 TB", "512GB SSD NVMe")
   - price (cena – zachowaj walutę z maila: PLN, EUR, USD, GBP; format np. "1160,00 PLN", "850,00 EUR")
   - graphicsCard (karta graficzna, np. "Iris Xe", "NVIDIA RTX 3060", "Intel UHD" – jeśli podana, w przeciwnym razie null)
4. Znajdź stan/grade (np. "KLASA A", "Grade A", "85% A") jeśli jest podany
5. Oblicz totalną cenę i ilość laptopów jeśli ma to sens

KRYTYCZNE: Jeśli w mailu jest opis choć JEDNEGO laptopa (nazwa/model + parametry lub cena) – ZAWSZE wpisz go do tablicy "laptops" i wypełnij WSZYSTKIE pola (ram, storage, price, graphicsCard) na podstawie treści. NIE zostawiaj null jeśli te informacje są w mailu.

FORMAT JEDNA LINIA NA LAPTOP: Gdy w treści są linie typu "DELL Latitude 5320 i5-1145G7 16GB 512GB SSD 13\" FHD Intel W11P CAM  820,00 zł" – KAŻDA taka linia to jeden wpis w "laptops". Wyciągnij: model (np. "DELL Latitude 5320"), ram ("16 GB"), storage ("512 GB SSD"), price ("820,00 PLN"), graphicsCard (z linii jeśli jest, np. "Intel", "MX250", "RTX A1000").

PRZYKŁAD WYCIĄGANIA: Gdy w treści jest np. "i5-1135G7 | 16GB RAM | 512GB SSD NVMe", "CENA : 1 240,00 zł >>> 1 160,00 zł" – zwróć: ram: "16 GB", storage: "512 GB SSD NVMe", price: "1160,00 PLN". Szukaj liczb przy "RAM", "GB", "TB", "SSD", "NVMe" dla RAM i dysku; szukaj "zł", "PLN", "EUR", "CENA" dla ceny; szukaj "Iris", "NVIDIA", "AMD", "RTX", "Radeon", "MX", "Intel" dla karty.

CENY: Akceptuj walutę z maila (zł/PLN, EUR, USD, GBP). Użyj ceny po przecenie jeśli jest (np. ">>> 1 160,00 zł"). Format: "1160,00 PLN" lub "850,00 EUR".

TREŚĆ MAILA:
${emailContent}

ODPOWIEDZ W FORMACIE JSON:
{
  "laptops": [
    {
      "model": "string",
      "ram": "string",
      "storage": "string",
      "price": "string (np. 1160,00 PLN lub 850,00 EUR)",
      "graphicsCard": "string lub null"
    }
  ],
  "grade": "string lub null",
  "totalPrice": "string lub null",
  "totalQuantity": number
}

ZWRÓĆ TYLKO JSON, BEZ ŻADNEGO DODATKOWEGO TEKSTU!`;
}
