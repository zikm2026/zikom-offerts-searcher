export function createMonitorExcelPrompt(excelJson: unknown[][]): string {
  const jsonStr = JSON.stringify(excelJson, null, 2);
  return `Jesteś ekspertem w analizie ofert MONITORÓW w plikach Excel.

Otrzymujesz dane z pliku Excel w formacie JSON. Wyciągnij WSZYSTKIE monitory.

Dla każdego monitora zwróć:
- model (nazwa/model monitora lub null)
- sizeInches (wielkość ekranu w calach – liczba, np. 22, 24, 27, 32; lub string "24")
- resolution (rozdzielczość jeśli podana, np. "1920x1080", "2560x1440"; jeśli nie ma w ofercie – null)
- price (cena TAK JAK W EXCELU – np. "3000" lub "3000 EUR" – NIE dziel przez ilość, zwróć wartość z arkusza)
- amount (liczba sztuk w wierszu – jeśli w Excelu jest kolumna amount/quantity/ilość/szt, zwróć ją jako number; jeśli brak – 1)

WAŻNE: Cena w Excelu często jest ZA CAŁĄ PARTIĘ (np. 3000 za 30 szt.). Zawsze zwróć "price" jako wartość z arkusza i "amount" jako ilość sztuk. System sam obliczy cenę za sztukę.

Zasady: wielkość ekranu często jest jako 24", 27 cali – zwróć liczbę. Rozdzielczość jako 1920x1080 lub Full HD → "1920x1080".

ODPOWIEDZ TYLKO JSON:
{
  "monitors": [
    { "model": "string lub null", "sizeInches": number lub string, "resolution": "string lub null", "price": "string", "amount": number }
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
- sizeInches (wielkość w calach – np. 24, 27, 32; przy przedziale np. "32-34" użyj środka lub dolnej granicy, np. 32)
- resolution (rozdzielczość tylko jeśli podana w tekście, np. QHD, 2560x1440; jeśli nie ma – null)
- price (cena za całą partię z walutą, np. "1.000,00 €", "1.373,00 €")
- amount (liczba sztuk z opisu, np. "7x" → 7, "29x" → 29)

ODPOWIEDZ TYLKO JSON:
{
  "monitors": [
    { "model": "string lub null", "sizeInches": number, "resolution": "string lub null", "price": "string", "amount": number }
  ],
  "totalPrice": "string lub null",
  "totalQuantity": number
}

TREŚĆ MAILA:
${emailContent}`;
}
