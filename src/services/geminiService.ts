import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmailMessage, OfferAnalysis, ExcelData, LaptopSpec } from '../types/email';
import logger from '../utils/logger';

interface GeminiConfig {
  apiKey: string;
  model: string;
}

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(config: GeminiConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: config.model });
  }

  async analyzeEmailOffer(email: EmailMessage, retries: number = 3): Promise<OfferAnalysis> {
    try {
      logger.debug(`Analyzing email from ${email.from} with subject: ${email.subject}`);

      const emailContent = this.prepareEmailContent(email, 4000, true);
      const prompt = this.createAnalysisPrompt(emailContent);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.debug(`Gemini raw response: ${text}`);

      return this.parseGeminiResponse(text);
    } catch (error: any) {
      const isRetryableError = 
        error?.status === 503 || 
        error?.status === 429 || 
        error?.status === 500 ||
        error?.statusText === 'Service Unavailable' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('rate limit');

      if (isRetryableError && retries > 0) {
        const delay = Math.pow(2, 4 - retries) * 1000;
        logger.warn(
          `Gemini API error (${error?.status || 'unknown'}): ${error?.message || 'Service unavailable'}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.analyzeEmailOffer(email, retries - 1);
      }

      logger.error('Error analyzing email with Gemini:', error);
      
      if (isRetryableError) {
        logger.warn('⚠️  Gemini API is overloaded/unavailable. Using fallback analysis.');
      }
      
      return this.fallbackAnalysis(email);
    }
  }

  private prepareEmailContent(email: EmailMessage, maxLength: number = 2000, forParsingLaptops: boolean = false): string {
    const content = [];
    
    content.push(`From: ${email.from}`);
    content.push(`Subject: ${email.subject}`);
    content.push(`Date: ${email.date.toISOString()}`);
    
    const half = Math.floor(maxLength / 2);
    if (forParsingLaptops && email.text && email.html) {
      content.push(`Text Content: ${email.text.substring(0, half)}`);
      const htmlText = email.html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/tr>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, half);
      content.push(`HTML Content (cleaned): ${htmlText}`);
    } else if (email.text) {
      content.push(`Text Content: ${email.text.substring(0, maxLength)}`);
    } else if (email.html) {
      const htmlText = email.html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/tr>/gi, '\n')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, maxLength);
      content.push(`HTML Content (cleaned): ${htmlText}`);
    }

    return content.join('\n\n');
  }

  private createAnalysisPrompt(emailContent: string): string {
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

  private parseGeminiResponse(response: string): OfferAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        isOffer: Boolean(parsed.isOffer),
        confidence: Math.min(Math.max(Number(parsed.confidence) || 0, 0), 100),
        category: parsed.category || undefined,
        details: {
          productType: parsed.details?.productType || undefined,
          brand: parsed.details?.brand || undefined,
          model: parsed.details?.model || undefined,
          price: parsed.details?.price || undefined,
          discount: parsed.details?.discount || undefined,
          store: parsed.details?.store || undefined,
        },
        reasoning: parsed.reasoning || undefined,
      };
    } catch (error) {
      logger.warn('Failed to parse Gemini response as JSON:', error);
      logger.debug('Raw response:', response);
      
      const isOfferMatch = /(?:is.*offer|oferta).*?(?:true|tak|yes)/i.test(response);
      const confidenceMatch = response.match(/(?:confidence|pewność).*?(\d+)/i);
      
      return {
        isOffer: isOfferMatch,
        confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 50,
        reasoning: 'Parsed from text response due to JSON parsing error',
      };
    }
  }

  private fallbackAnalysis(email: EmailMessage): OfferAnalysis {
    const content = `${email.subject} ${email.from} ${email.text || ''}`.toLowerCase();
      
    const laptopKeywords = [
      'laptop', 'notebook', 'ultrabook', 'macbook', 'thinkpad', 'dell', 'hp', 'lenovo', 
      'asus', 'acer', 'msi', 'komputer', 'pc', 'desktop', 'workstation'
    ];
    
    const offerKeywords = [
      'promocja', 'rabat', 'okazja', 'wyprzedaż', 'oferta', 'cena', 'zł', 'pln', 
      'euro', 'taniej', 'oszczędź', 'kup', 'zamów', 'sklep', 'allegro', 'ceneo'
    ];
    
    const laptopScore = laptopKeywords.filter(keyword => content.includes(keyword)).length;
    const offerScore = offerKeywords.filter(keyword => content.includes(keyword)).length;
    
    const isOffer = laptopScore > 0 && offerScore > 0;
    const confidence = Math.min((laptopScore * 20) + (offerScore * 15), 100);
    
    return {
      isOffer,
      confidence,
      category: laptopScore > 0 ? 'laptop' : undefined,
      reasoning: `Fallback analysis: laptop keywords: ${laptopScore}, offer keywords: ${offerScore}`,
    };
  }

  async parseExcelData(excelJson: any[][], retries: number = 3): Promise<ExcelData> {
    try {
      logger.debug(`📊 Wysyłam Excel do Gemini AI (${excelJson.length} wierszy)...`);

      const prompt = this.createExcelParsingPrompt(excelJson);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.debug(`Gemini Excel response (first 500 chars): ${text.substring(0, 500)}`);

      return this.parseExcelResponse(text);
    } catch (error: any) {
      const isRetryableError = 
        error?.status === 503 || 
        error?.status === 429 || 
        error?.status === 500 ||
        error?.statusText === 'Service Unavailable' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('rate limit');

      if (isRetryableError && retries > 0) {
        const delay = Math.pow(2, 4 - retries) * 1000;
        logger.warn(
          `Gemini API error during Excel parsing: ${error?.message}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.parseExcelData(excelJson, retries - 1);
      }

      logger.error('Failed to parse Excel with Gemini:', error);
      throw error;
    }
  }

  private createExcelParsingPrompt(excelJson: any[][]): string {
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

  private normalizePriceFromGemini(value: any): string | undefined {
    if (value == null) return undefined;
    const s = String(value).trim().toLowerCase();
    if (s === '' || s === 'null' || s === 'undefined') return undefined;
    return String(value).trim();
  }

  private applyTotalPriceFallback(laptops: LaptopSpec[], totalPrice: string | undefined, totalQuantity: number): void {
    if (!totalPrice || laptops.length === 0) return;
    const count = totalQuantity > 0 ? totalQuantity : laptops.length;
    const withoutPrice = laptops.filter(l => !this.normalizePriceFromGemini(l.price));
    if (withoutPrice.length === 0) return;
    const priceUpper = totalPrice.toUpperCase();
    const numStr = totalPrice.replace(/[^\d.,]/g, '').replace(',', '.');
    const totalNum = parseFloat(numStr);
    if (isNaN(totalNum) || totalNum <= 0) return;
    const currency = priceUpper.includes('PLN') ? 'PLN' : priceUpper.includes('USD') ? 'USD' : priceUpper.includes('GBP') ? 'GBP' : 'EUR';
    const perUnit = totalNum / count;
    const priceFormatted = `${perUnit.toFixed(2).replace('.', ',')} ${currency}`;
    laptops.forEach(l => {
      if (!this.normalizePriceFromGemini(l.price)) l.price = priceFormatted;
    });
    logger.debug(`📊 Uzupełniono cenę z totalPrice: ${totalPrice} → ${priceFormatted} na laptop (${withoutPrice.length} szt.)`);
  }

  private fillMissingFromEmailText(laptops: LaptopSpec[], rawText: string): void {
    if (!rawText || laptops.length === 0) return;
    const text = rawText.replace(/\s+/g, ' ');

    const priceNettoMatch = text.match(/(\d[\d\s]*)\s*zł\s*netto/i);
    const priceAnyMatch = text.match(/(\d[\d\s]*)\s*zł/i);
    let priceStr: string | undefined;
    if (priceNettoMatch) {
      priceStr = priceNettoMatch[1].replace(/\s/g, '').replace('.', ',').replace(/,$/, '') + ',00 PLN';
    } else if (priceAnyMatch) {
      priceStr = priceAnyMatch[1].replace(/\s/g, '').replace('.', ',').replace(/,$/, '') + ',00 PLN';
    }
    const eurMatch = text.match(/(\d[\d\s.,]*)\s*[€EUR]/i);
    if (!priceStr && eurMatch) {
      priceStr = eurMatch[1].replace(/\s/g, '').replace(',', '.') + ' EUR';
    }

    const ramMatch = text.match(/(\d+)\s*GB\s*RAM/i) || text.match(/\|\s*(\d+)GB\s*\|/i) || text.match(/(\d+)\s*GB\s*\|/);
    const ramStr = ramMatch ? `${ramMatch[1]} GB` : undefined;

    const storageNvme = text.match(/(\d+)\s*GB\s*SSD\s*NVMe/i);
    const storageTb = text.match(/(\d+)\s*TB/i);
    const storageGb = text.match(/(\d+)\s*GB\s*SSD/i) || text.match(/(\d+)\s*GB\s*NVMe/i);
    let storageStr: string | undefined;
    if (storageNvme) storageStr = `${storageNvme[1]} GB SSD NVMe`;
    else if (storageTb) storageStr = `${storageTb[1]} TB`;
    else if (storageGb) storageStr = `${storageGb[1]} GB`;

    const gfxMatch = text.match(/(Intel\s+UHD|Iris\s*Xe|NVIDIA\s+[A-Z0-9\s]+|AMD\s+Radeon\s+[A-Z0-9\s]+|UHD\s+Graphics\s*\d*)/i);
    const gfxStr = gfxMatch ? gfxMatch[1].trim() : undefined;

    let filled = 0;
    laptops.forEach(l => {
      if (!l.price && priceStr) { l.price = priceStr; filled++; }
      if (!l.ram && ramStr) { l.ram = ramStr; filled++; }
      if (!l.storage && storageStr) { l.storage = storageStr; filled++; }
      if (!l.graphicsCard && gfxStr) { l.graphicsCard = gfxStr; filled++; }
    });
    if (filled > 0) logger.debug(`📊 Uzupełniono ${filled} pól z treści maila (regex fallback)`);
  }

  private parseExcelResponse(text: string): ExcelData {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const laptops: LaptopSpec[] = (parsed.laptops || []).map((laptop: any) => ({
        model: laptop.model || undefined,
        ram: laptop.ram || undefined,
        storage: laptop.storage || undefined,
        price: this.normalizePriceFromGemini(laptop.price),
        graphicsCard: laptop.graphicsCard || undefined,
      }));

      const totalPrice = this.normalizePriceFromGemini(parsed.totalPrice);
      const totalQuantity = Math.max(0, Number(parsed.totalQuantity) || laptops.length);

      this.applyTotalPriceFallback(laptops, totalPrice, totalQuantity);

      logger.info(`✅ Gemini wyciągnęło ${laptops.length} laptopów`);

      return {
        laptops,
        totalPrice: totalPrice || undefined,
        totalQuantity: totalQuantity || laptops.length,
        grade: parsed.grade || undefined,
      };
    } catch (error) {
      logger.error('Failed to parse Gemini Excel response:', error);
      logger.error('Response text:', text);
      
      return {
        laptops: [],
        totalQuantity: 0,
      };
    }
  }

  async parseEmailContent(email: EmailMessage, retries: number = 3): Promise<ExcelData> {
    try {
      logger.debug(`📧 Wysyłam treść maila do Gemini AI do wyciągnięcia danych o laptopach...`);

      const emailContent = this.prepareEmailContent(email, 8000, true);
      const prompt = this.createEmailContentParsingPrompt(emailContent);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      logger.debug(`Gemini email content response (first 500 chars): ${text.substring(0, 500)}`);

      const excelData = this.parseEmailContentResponse(text);
      const rawText = [email.text || '', (email.html || '').replace(/<[^>]*>/g, ' ')].join(' ');
      this.fillMissingFromEmailText(excelData.laptops, rawText);
      return excelData;
    } catch (error: any) {
      const isRetryableError = 
        error?.status === 503 || 
        error?.status === 429 || 
        error?.status === 500 ||
        error?.statusText === 'Service Unavailable' ||
        error?.message?.includes('overloaded') ||
        error?.message?.includes('rate limit');

      if (isRetryableError && retries > 0) {
        const delay = Math.pow(2, 4 - retries) * 1000;
        logger.warn(
          `Gemini API error during email content parsing: ${error?.message}. Retrying in ${delay}ms... (${retries} attempts left)`
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.parseEmailContent(email, retries - 1);
      }

      logger.warn(
        `Gemini API limit/error (429 lub niedostępność) – nie wyciągnięto laptopów z treści maila. Zwracam pustą listę.`
      );
      return { laptops: [], totalQuantity: 0 };
    }
  }

  private createEmailContentParsingPrompt(emailContent: string): string {
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

PRZYKŁAD WYCIĄGANIA: Gdy w treści jest np. "i5-1135G7 | 16GB RAM | 512GB SSD NVMe", "14.1\" | FHD-TOUCH | IrisXe", "CENA : 1 240,00 zł netto >>> 1 160,00 zł netto", "KLASA A" – zwróć: ram: "16 GB", storage: "512 GB SSD NVMe", price: "1160,00 PLN", graphicsCard: "Iris Xe". Szukaj liczb przy "RAM", "GB", "TB", "SSD", "NVMe" dla RAM i dysku; szukaj "zł", "PLN", "EUR", "CENA" dla ceny; szukaj "Iris", "NVIDIA", "AMD", "RTX", "Radeon" dla karty.

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

  private parseEmailContentResponse(text: string): ExcelData {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const laptops: LaptopSpec[] = (parsed.laptops || []).map((laptop: any) => ({
        model: laptop.model || undefined,
        ram: laptop.ram || undefined,
        storage: laptop.storage || undefined,
        price: this.normalizePriceFromGemini(laptop.price),
        graphicsCard: laptop.graphicsCard || undefined,
      }));

      const totalPrice = this.normalizePriceFromGemini(parsed.totalPrice);
      const totalQuantity = Math.max(0, Number(parsed.totalQuantity) || laptops.length);
      this.applyTotalPriceFallback(laptops, totalPrice, totalQuantity);

      logger.info(`✅ Gemini wyciągnęło ${laptops.length} laptopów z treści maila`);

      return {
        laptops,
        totalPrice: totalPrice || undefined,
        totalQuantity: totalQuantity || laptops.length,
        grade: parsed.grade || undefined,
      };
    } catch (error) {
      logger.error('Failed to parse Gemini email content response:', error);
      logger.error('Response text:', text);
      
      return {
        laptops: [],
        totalQuantity: 0,
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Test connection. Respond with "OK".');
      const response = await result.response;
      const text = response.text();
      
      logger.info('Gemini connection test successful');
      return text.toLowerCase().includes('ok');
    } catch (error) {
      logger.error('Gemini connection test failed:', error);
      return false;
    }
  }
}

export default GeminiService;