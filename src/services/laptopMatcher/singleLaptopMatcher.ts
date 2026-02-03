import type { WatchedLaptop } from '@prisma/client';
import type { LaptopSpec, MatchResult } from '../../types/email';
import { isModelMatch } from './matchers/modelMatcher';
import { calculateMaxAllowedPrice } from './calculators/maxPriceCalculator';
import { normalizePrice } from './normalizers/priceNormalizer';
import CurrencyService from '../currencyService';

function toMatchResultWatched(wl: WatchedLaptop): MatchResult['watchedLaptop'] {
  return {
    id: wl.id,
    model: wl.model,
    maxPriceWorst: wl.maxPriceWorst,
    maxPriceBest: wl.maxPriceBest,
    ramFrom: wl.ramFrom,
    ramTo: wl.ramTo,
    storageFrom: wl.storageFrom,
    storageTo: wl.storageTo,
    gradeFrom: wl.gradeFrom,
    gradeTo: wl.gradeTo,
    graphicsCard: wl.graphicsCard ?? null,
  };
}

export async function matchLaptop(
  laptop: LaptopSpec,
  watchedLaptops: WatchedLaptop[],
  currencyService: CurrencyService,
  offerGrade?: string | null
): Promise<MatchResult | null> {
  const watchedLaptop = watchedLaptops.find((wl) =>
    isModelMatch(laptop.model, wl.model)
  );

  if (!watchedLaptop) {
    return null;
  }

  const { maxPrice, reason } = await calculateMaxAllowedPrice(
    laptop,
    watchedLaptop,
    currencyService,
    offerGrade
  );

  if (maxPrice === 0) {
    return {
      laptop,
      watchedLaptop: toMatchResultWatched(watchedLaptop),
      maxAllowedPrice: 0,
      actualPrice: 0,
      isMatch: false,
      reason,
    };
  }

  const actualPrice = await normalizePrice(laptop.price, currencyService);

  if (actualPrice === null) {
    return {
      laptop,
      watchedLaptop: toMatchResultWatched(watchedLaptop),
      maxAllowedPrice: maxPrice,
      actualPrice: 0,
      isMatch: false,
      reason: 'Brak ceny w ofercie',
    };
  }

  const isMatch = actualPrice <= maxPrice;

  return {
    laptop,
    watchedLaptop: toMatchResultWatched(watchedLaptop),
    maxAllowedPrice: maxPrice,
    actualPrice,
    isMatch,
    reason: isMatch
      ? `✅ ${reason} → max ${maxPrice.toFixed(2).replace('.', ',')} €, cena: ${actualPrice.toFixed(2).replace('.', ',')} €`
      : `❌ ${reason} → max ${maxPrice.toFixed(2).replace('.', ',')} €, cena: ${actualPrice.toFixed(2).replace('.', ',')} € (za drogo!)`,
  };
}
