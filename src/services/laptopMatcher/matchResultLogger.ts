import type { EmailMatchResult } from '../../types/email';
import logger from '../../utils/logger';

export function logMatchResults(
  emailSubject: string,
  matchResult: EmailMatchResult
): void {
  logger.info('\n' + '='.repeat(80));
  logger.info(`📧 EMAIL: ${emailSubject}`);
  logger.info('='.repeat(80));

  if (matchResult.shouldNotify) {
    logger.info('🎯 ✅ EMAIL INTERESUJĄCY - WYSTARCZAJĄCO LAPTOPÓW SPEŁNIA KRYTERIA!');
  } else if (matchResult.allLaptopsMatched && matchResult.matchedCount > 0) {
    logger.info(
      `⚠️  WSZYSTKIE LAPTOPY W BAZIE, ALE TYLKO ${matchResult.matchedCount}/${matchResult.totalCount} SPEŁNIA KRYTERIA CENOWE (poniżej progu 90%)`
    );
  } else if (matchResult.allLaptopsMatched) {
    logger.info('⚠️  WSZYSTKIE LAPTOPY W BAZIE, ALE ŻADEN NIE SPEŁNIA KRYTERIÓW CENOWYCH');
  } else {
    logger.info(
      `❌ EMAIL POMINIĘTY - Tylko ${matchResult.matches.length}/${matchResult.totalCount} laptopów w bazie`
    );
  }

  logger.info(
    `📊 Statystyki: ${matchResult.matchedCount} spełnia kryteria / ${matchResult.totalCount} w ofercie`
  );
  logger.info('-'.repeat(80));

  if (matchResult.matches.length > 0) {
    logger.info('💻 SZCZEGÓŁY LAPTOPÓW:');
    matchResult.matches.forEach((match, index) => {
      logger.info(`\n   ${index + 1}. ${match.laptop.model || 'Unknown Model'}`);
      logger.info(`      ${match.reason}`);
    });
  }

  logger.info('='.repeat(80) + '\n');
}
