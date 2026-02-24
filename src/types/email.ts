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

export type OfferType = 'laptop' | 'monitor' | 'desktop';

export interface OfferAnalysis {
  isOffer: boolean;
  confidence: number;
  category?: string;
  offerType?: OfferType;
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
  amount?: number;
}

export interface ExcelData {
  laptops: LaptopSpec[];
  totalPrice?: string;
  totalQuantity?: number;
  grade?: string;
}

export interface MonitorSpec {
  model?: string;
  sizeInches?: number | string;
  resolution?: string;
  price?: string;
  amount?: number;
}

export interface MonitorData {
  monitors: MonitorSpec[];
  totalPrice?: string;
  totalQuantity?: number;
}

export type DesktopCaseType = 'Tower' | 'SFF' | 'Mini';

export interface DesktopSpec {
  model?: string;
  caseType?: DesktopCaseType | string;
  ram?: string;
  storage?: string;
  price?: string;
  amount?: number;
}

export interface DesktopData {
  desktops: DesktopSpec[];
  totalPrice?: string;
  totalQuantity?: number;
}

export interface MonitorMatchResult {
  monitor: MonitorSpec;
  watchedMonitor: { id: string; sizeInchesMin?: number | null; sizeInchesMax?: number | null; resolutionMin?: string | null; resolutionMax?: string | null; maxPrice?: string | null };
  maxAllowedPrice: number;
  actualPrice: number;
  isMatch: boolean;
  reason: string;
}

export interface MonitorEmailMatchResult {
  allMatched: boolean;
  matchedCount: number;
  totalCount: number;
  matches: MonitorMatchResult[];
  shouldNotify: boolean;
}

export interface DesktopMatchResult {
  desktop: DesktopSpec;
  watchedDesktop: { id: string; caseType: string; maxPrice?: string | null; ramFrom?: string | null; ramTo?: string | null; storageFrom?: string | null; storageTo?: string | null };
  maxAllowedPrice: number;
  actualPrice: number;
  isMatch: boolean;
  reason: string;
}

export interface DesktopEmailMatchResult {
  allMatched: boolean;
  matchedCount: number;
  totalCount: number;
  matches: DesktopMatchResult[];
  shouldNotify: boolean;
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