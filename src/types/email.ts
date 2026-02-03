export interface EmailMessage {
  uid: number;
  from: string;
  subject: string;
  date: Date;
  text?: string;
  html?: string;
}

export interface EmailServiceConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  checkInterval: number;
  processTimeoutMs?: number;
}

export interface OfferAnalysis {
  isOffer: boolean;
  confidence: number;
  category?: string;
  details?: {
    productType?: string;
    brand?: string;
    model?: string;
    price?: string;
    discount?: string;
    store?: string;
  };
  reasoning?: string;
}

export interface LaptopSpec {
  model?: string;
  ram?: string;
  storage?: string;
  price?: string;
  graphicsCard?: string;
}

export interface ExcelData {
  laptops: LaptopSpec[];
  totalPrice?: string;
  totalQuantity?: number;
  grade?: string;
}

export interface AnalyzedEmail extends EmailMessage {
  analysis?: OfferAnalysis;
  excelData?: ExcelData;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export interface MatchResult {
  laptop: LaptopSpec;
  watchedLaptop: {
    id: string;
    model: string;
    maxPriceWorst?: string | null;
    maxPriceBest?: string | null;
    ramFrom?: string | null;
    ramTo?: string | null;
    storageFrom?: string | null;
    storageTo?: string | null;
    gradeFrom?: string | null;
    gradeTo?: string | null;
    graphicsCard?: string | null;
  };
  maxAllowedPrice: number;
  actualPrice: number;
  isMatch: boolean;
  reason: string;
}

export interface EmailMatchResult {
  allLaptopsMatched: boolean;
  matchedCount: number;
  totalCount: number;
  matches: MatchResult[];
  shouldNotify: boolean;
}