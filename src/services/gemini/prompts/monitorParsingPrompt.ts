export function createMonitorExcelPrompt(excelJson: unknown[][]): string {
  const jsonStr = JSON.stringify(excelJson, null, 2);
  return `Jesteś ekspertem w analizie ofert MONITORÓW w plikach Excel.

Otrzymujesz dane z pliku Excel w formacie JSON. Wyciągnij WSZYSTKIE monitory.

Dla każdego monitora zwróć:
- model (nazwa/model monitora lub null)
- sizeInches (wielkość ekranu w calach – liczba, np. 22, 24, 27, 32; lub string "24")
- resolution (rozdzielczość, np. "1920x1080", "2560x1440", "3440x1440")
- price (cena w formacie "XXX,XX EUR" lub z walutą z oferty)

Zasady: wielkość ekranu często jest jako 24", 27 cali, 27 inch – zwróć liczbę. Rozdzielczość jako 1920x1080 lub Full HD → "1920x1080".

ODPOWIEDZ TYLKO JSON:
{
  "monitors": [
    { "model": "string lub null", "sizeInches": number lub string, "resolution": "string", "price": "string" }
  ],
  "totalPrice": "string lub null",
  "totalQuantity": number
}

DANE EXCEL:
${jsonStr}`;
}

export function createMonitorEmailContentPrompt(emailContent: string): string {
  return `Jesteś ekspertem w analizie ofert MONITORÓW w treści maila.

Wyciągnij WSZYSTKIE monitory z treści. Dla każdego:
- model (nazwa/model lub null)
- sizeInches (wielkość w calach – np. 24, 27)
- resolution (np. 1920x1080, 2560x1440)
- price (cena z walutą, np. "500,00 PLN" lub "120,00 EUR")

ODPOWIEDZ TYLKO JSON:
{
  "monitors": [
    { "model": "string lub null", "sizeInches": number, "resolution": "string", "price": "string" }
  ],
  "totalPrice": "string lub null",
  "totalQuantity": number
}

TREŚĆ MAILA:
${emailContent}`;
}
