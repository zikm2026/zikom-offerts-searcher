import type { WatchedLaptop } from '@prisma/client';
import type { LaptopSpec } from '../../../types/email';
import { normalizeToGB } from '../normalizers/specNormalizer';
import { normalizePrice } from '../normalizers/priceNormalizer';
import { isGraphicsCardMatch } from '../matchers/graphicsCardMatcher';
import { isGradeInRange } from '../matchers/gradeMatcher';
import CurrencyService from '../../currencyService';

export interface MaxPriceResult {
  maxPrice: number;
  reason: string;
}

export async function calculateMaxAllowedPrice(
  laptop: LaptopSpec,
  watchedLaptop: WatchedLaptop,
  currencyService: CurrencyService,
  offerGrade?: string | null
): Promise<MaxPriceResult> {
  const priceWorst = await normalizePrice(
    watchedLaptop.maxPriceWorst || '0',
    currencyService
  );
  const priceBest = await normalizePrice(
    watchedLaptop.maxPriceBest || '0',
    currencyService
  );

  if (priceWorst === null || priceBest === null) {
    return {
      maxPrice: 0,
      reason: 'Brak zdefiniowanych cen w bazie danych',
    };
  }

  const laptopRam = normalizeToGB(laptop.ram);
  const laptopStorage = normalizeToGB(laptop.storage);

  const ramFromDB = normalizeToGB(watchedLaptop.ramFrom || '0');
  const ramToDB = normalizeToGB(watchedLaptop.ramTo || '999999');
  const storageFromDB = normalizeToGB(watchedLaptop.storageFrom || '0');
  const storageToDB = normalizeToGB(watchedLaptop.storageTo || '999999');

  if (laptopRam === null || laptopStorage === null) {
    return {
      maxPrice: 0,
      reason: 'Brak informacji o RAM lub dysku w ofercie',
    };
  }

  if (ramFromDB !== null && laptopRam < ramFromDB) {
    return {
      maxPrice: 0,
      reason: `RAM ${laptop.ram} poniżej minimalnego (${watchedLaptop.ramFrom})`,
    };
  }

  if (ramToDB !== null && laptopRam > ramToDB) {
    return {
      maxPrice: 0,
      reason: `RAM ${laptop.ram} powyżej maksymalnego (${watchedLaptop.ramTo})`,
    };
  }

  if (storageFromDB !== null && laptopStorage < storageFromDB) {
    return {
      maxPrice: 0,
      reason: `Dysk ${laptop.storage} poniżej minimalnego (${watchedLaptop.storageFrom})`,
    };
  }

  if (storageToDB !== null && laptopStorage > storageToDB) {
    return {
      maxPrice: 0,
      reason: `Dysk ${laptop.storage} powyżej maksymalnego (${watchedLaptop.storageTo})`,
    };
  }

  const watchedGraphicsCard = watchedLaptop.graphicsCard ?? null;
  if (!isGraphicsCardMatch(laptop.graphicsCard, watchedGraphicsCard)) {
    const optionsLabel =
      watchedGraphicsCard?.includes(',') || watchedGraphicsCard?.includes('\n')
        ? 'żadnej z podanych kart'
        : 'wymaganej';
    return {
      maxPrice: 0,
      reason: `Karta graficzna "${laptop.graphicsCard || 'brak'}" nie pasuje do ${optionsLabel} (${watchedGraphicsCard})`,
    };
  }

  if (!isGradeInRange(offerGrade, watchedLaptop.gradeFrom, watchedLaptop.gradeTo)) {
    const range =
      watchedLaptop.gradeFrom && watchedLaptop.gradeTo
        ? `ocena w zakresie ${watchedLaptop.gradeTo}–${watchedLaptop.gradeFrom}`
        : watchedLaptop.gradeFrom
          ? `ocena min. ${watchedLaptop.gradeFrom}`
          : `ocena max ${watchedLaptop.gradeTo}`;
    return {
      maxPrice: 0,
      reason: `Ocena w ofercie "${offerGrade || 'brak'}" nie mieści się w wymaganym zakresie (${range})`,
    };
  }

  const ramRange = (ramToDB || 0) - (ramFromDB || 0);
  const storageRange = (storageToDB || 0) - (storageFromDB || 0);

  const ramFactor =
    ramRange > 0 ? ((laptopRam || 0) - (ramFromDB || 0)) / ramRange : 0.5;
  const storageFactor =
    storageRange > 0
      ? ((laptopStorage || 0) - (storageFromDB || 0)) / storageRange
      : 0.5;

  const avgFactor = (ramFactor + storageFactor) / 2;
  const maxPrice = priceWorst + (priceBest - priceWorst) * avgFactor;

  const reason =
    `RAM: ${laptop.ram} (${(ramFactor * 100).toFixed(0)}%), ` +
    `Dysk: ${laptop.storage} (${(storageFactor * 100).toFixed(0)}%), ` +
    `Średnia: ${(avgFactor * 100).toFixed(0)}%`;

  return { maxPrice: Math.round(maxPrice), reason };
}
