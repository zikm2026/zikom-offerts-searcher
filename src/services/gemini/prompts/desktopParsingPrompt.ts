export function createDesktopExcelPrompt(excelJson: unknown[][]): string {
  const jsonStr = JSON.stringify(excelJson, null, 2);
  return `Jesteś ekspertem w analizie ofert KOMPUTERÓW STACJONARNYCH (PC, desktop) w plikach Excel.

Wyciągnij WSZYSTKIE komputery stacjonarne. Dla każdego:
- model (nazwa/model lub null)
- caseType: jeden z "Tower" (pełna obudowa), "SFF" (mała obudowa, Small Form Factor), "Mini" (mini PC). Na podstawie opisu w Excel ustaw odpowiedni typ.
- ram (np. "8 GB", "16 GB")
- storage (dysk, np. "256 GB", "1 TB")
- price (cena TAK JAK W EXCELU – np. "5000" lub "5000 EUR" – NIE dziel przez ilość, zwróć wartość z arkusza)
- amount (liczba sztuk w wierszu – jeśli w Excelu jest kolumna amount/quantity/ilość/szt, zwróć ją jako number; jeśli brak – 1)

WAŻNE: Cena w Excelu często jest ZA CAŁĄ PARTIĘ (np. 5000 za 10 szt.). Zawsze zwróć "price" jako wartość z arkusza i "amount" jako ilość sztuk. System sam obliczy cenę za sztukę.

ODPOWIEDZ TYLKO JSON:
{
  "desktops": [
    { "model": "string lub null", "caseType": "Tower" | "SFF" | "Mini", "ram": "string", "storage": "string", "price": "string", "amount": number }
  ],
  "totalPrice": "string lub null",
  "totalQuantity": number
}

DANE EXCEL:
${jsonStr}`;
}

export function createDesktopEmailContentPrompt(emailContent: string): string {
  return `Jesteś ekspertem w analizie ofert KOMPUTERÓW STACJONARNYCH w treści maila.

Wyciągnij WSZYSTKIE komputery z maila. Nawet jeśli jest tylko JEDEN komputer (np. krótki opis: "tower, 32GB RAM, 2TB, 300 Euro") – zwróć go w tablicy "desktops" z jednym elementem.

Dla każdego komputera podaj:
- model (nazwa/model lub null)
- caseType: "Tower" (pełna obudowa, tower), "SFF" (mała obudowa), "Mini" (mini PC). Gdy w tekście jest "tower" lub "pełna" → "Tower". Gdy nie wiadomo → "Tower".
- ram (np. "32 GB", "16 GB")
- storage (dysk, np. "2 TB", "1 TB", "512 GB")
- price (cena z walutą, np. "300 Euro", "300 EUR", "1200 PLN")

WAŻNE: Jeśli w mailu jest choć jeden opis komputera (np. typ obudowy + RAM + dysk + cena), ZAWSZE zwróć co najmniej jeden wpis w "desktops". Nie zwracaj pustej tablicy.

ODPOWIEDZ TYLKO JSON:
{
  "desktops": [
    { "model": "string lub null", "caseType": "Tower"|"SFF"|"Mini", "ram": "string", "storage": "string", "price": "string" }
  ],
  "totalPrice": "string lub null",
  "totalQuantity": number
}

TREŚĆ MAILA:
${emailContent}`;
}
