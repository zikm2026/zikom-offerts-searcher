export function createDesktopExcelPrompt(excelJson: unknown[][]): string {
  const jsonStr = JSON.stringify(excelJson, null, 2);
  return `Jesteś ekspertem w analizie ofert KOMPUTERÓW STACJONARNYCH (PC, desktop) w plikach Excel.

Wyciągnij WSZYSTKIE komputery stacjonarne. Dla każdego:
- model (nazwa/model lub null)
- caseType: jeden z "Tower" (pełna obudowa), "SFF" (mała obudowa, Small Form Factor), "Mini" (mini PC). Na podstawie opisu w Excel ustaw odpowiedni typ.
- ram (np. "8 GB", "16 GB")
- storage (dysk, np. "256 GB", "1 TB")
- price (cena w formacie "XXX,XX EUR" lub waluta z oferty)

ODPOWIEDZ TYLKO JSON:
{
  "desktops": [
    { "model": "string lub null", "caseType": "Tower" | "SFF" | "Mini", "ram": "string", "storage": "string", "price": "string" }
  ],
  "totalPrice": "string lub null",
  "totalQuantity": number
}

DANE EXCEL:
${jsonStr}`;
}

export function createDesktopEmailContentPrompt(emailContent: string): string {
  return `Jesteś ekspertem w analizie ofert KOMPUTERÓW STACJONARNYCH w treści maila.

Wyciągnij WSZYSTKIE komputery. Dla każdego:
- model (nazwa lub null)
- caseType: "Tower" | "SFF" | "Mini" (na podstawie opisu: pełna obudowa/tower, mała/SFF, mini PC)
- ram, storage, price (z zachowaniem waluty)

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
