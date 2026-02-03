export function createExcelParsingPrompt(excelJson: unknown[][]): string {
  const jsonStr = JSON.stringify(excelJson, null, 2);

  return `Jesteś ekspertem w analizie ofert laptopów w plikach Excel.

Otrzymujesz dane z pliku Excel w formacie JSON (tablica wierszy).

TWOJE ZADANIE:
1. Przeanalizuj strukturę danych
2. Znajdź wszystkie laptopy w dokumencie
3. Dla każdego laptopa wyciągnij:
   - model (nazwa laptopa, np. "EliteBook 845 G8", "ThinkPad X1", "Surface Laptop")
   - ram (pamięć RAM, np. "8 GB", "16 GB", "32 GB")
   - storage (dysk, np. "256 GB", "512 GB", "1 TB")
   - price (cena w formacie "XXX,XX EUR" lub "XXX,XX USD" lub "XXX,XX GBP", np. "850,00 EUR", "1000,00 USD", "800,00 GBP")
   - graphicsCard (karta graficzna, np. "NVIDIA RTX 3060", "AMD Radeon RX 6600", "Intel UHD Graphics", "NVIDIA GeForce GTX 1650" - jeśli jest dostępna, w przeciwnym razie null)
4. Znajdź stan/grade (np. "85% A/A- Grade, 15% B Grade")
5. Oblicz totalną cenę (jeśli jest)

WAŻNE ZASADY DLA CEN:
- Jeśli KAŻDY laptop ma swoją indywidualną cenę w swoim wierszu → użyj tych cen
- Jeśli laptopy są w PACZCE z jedną ceną dla całej paczki → podziel cenę paczki przez ilość laptopów
- Jeśli jest kilka paczek → każda paczka ma swoją cenę, podziel osobno
- Jeśli widzisz cenę "Price" w kolumnie dla każdego laptopa → to jest cena jednostkowa
- Jeśli widzisz dużą cenę (np. 4000EUR) i 5 laptopów → to 4000/5 = 800EUR na laptop
- WAŻNE: Zawsze zwracaj walutę w formacie "XXX,XX EUR/USD/GBP" - wykryj walutę z oferty (domyślnie EUR jeśli nie podano)

DANE EXCEL:
${jsonStr}

ODPOWIEDZ W FORMACIE JSON:
{
  "laptops": [
    {
      "model": "string",
      "ram": "string",
      "storage": "string",
      "price": "string w formacie XXX,XX EUR/USD/GBP",
      "graphicsCard": "string lub null"
    }
  ],
  "grade": "string lub null",
  "totalPrice": "string w formacie XXX,XX EUR/USD/GBP lub null",
  "totalQuantity": number
}

ZWRÓĆ TYLKO JSON, BEZ ŻADNEGO DODATKOWEGO TEKSTU!`;
}
