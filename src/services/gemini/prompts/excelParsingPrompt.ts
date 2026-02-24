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
   - price (cena TAK JAK W EXCELU – np. "4000" lub "4000 EUR" za partię – NIE dziel przez ilość, zwróć wartość z arkusza)
   - amount (liczba sztuk w wierszu – jeśli w Excelu jest kolumna amount/quantity/ilość/szt, zwróć ją jako number; jeśli brak – 1)
   - graphicsCard (karta graficzna, np. "NVIDIA RTX 3060", "Intel UHD Graphics" – jeśli jest, w przeciwnym razie null)
4. Znajdź stan/grade (np. "85% A/A- Grade, 15% B Grade")
5. Oblicz totalną cenę (jeśli jest)

WAŻNE ZASADY DLA CEN I ILOŚCI:
- price: zwróć wartość TAK JAK W ARKUSZU (np. 4000 za 10 szt. → price "4000", amount 10). System sam obliczy cenę za sztukę.
- amount: jeśli w Excelu jest kolumna amount/quantity/ilość/szt – zwróć ją dla każdego wiersza; jeśli brak – 1.
- Zawsze podaj walutę w price (np. "4000 EUR", "850,00 PLN") – wykryj z oferty, domyślnie EUR.

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
      "amount": number,
      "graphicsCard": "string lub null"
    }
  ],
  "grade": "string lub null",
  "totalPrice": "string w formacie XXX,XX EUR/USD/GBP lub null",
  "totalQuantity": number
}

ZWRÓĆ TYLKO JSON, BEZ ŻADNEGO DODATKOWEGO TEKSTU!`;
}
