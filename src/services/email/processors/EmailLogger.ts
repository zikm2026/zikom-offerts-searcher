import { ExcelData } from '../../../types/email';
import logger from '../../../utils/logger';

export class EmailLogger {
  logAllLaptops(excelData: ExcelData, emailSubject: string): void {
    if (!excelData.laptops || excelData.laptops.length === 0) {
      return;
    }

    logger.info('\n' + '='.repeat(120));
    logger.info(`📧 EMAIL: ${emailSubject}`);
    logger.info(`📊 ZNALEZIONE LAPTOPY (${excelData.laptops.length} szt.):`);
    logger.info('='.repeat(120));

    if (excelData.grade) {
      logger.info(`⭐ Stan (Grade): ${excelData.grade}`);
    }
    if (excelData.totalPrice) {
      logger.info(`💰 Cena całkowita: ${excelData.totalPrice}`);
    }
    if (excelData.totalQuantity) {
      logger.info(`📦 Ilość: ${excelData.totalQuantity} szt.`);
    }

    logger.info('-'.repeat(120));
    logger.info('┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
    logger.info('│  # │ Model                          │ Cena        │ Stan │ RAM        │ Pamięć         │ Karta                  │');
    logger.info('├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤');

    excelData.laptops.forEach((laptop, index) => {
      const model = (laptop.model || 'Brak modelu').padEnd(30).substring(0, 30);
      const price = (laptop.price || 'Brak ceny').padEnd(11).substring(0, 11);
      const grade = (excelData.grade || 'N/A').padEnd(5).substring(0, 5);
      const ram = (laptop.ram || 'Brak RAM').padEnd(11).substring(0, 11);
      const storage = (laptop.storage || 'Brak dysku').padEnd(15).substring(0, 15);
      const graphics = (laptop.graphicsCard || '–').padEnd(24).substring(0, 24);

      logger.info(`│ ${String(index + 1).padStart(2)} │ ${model} │ ${price} │ ${grade} │ ${ram} │ ${storage} │ ${graphics} │`);
    });

    logger.info('└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘');
    logger.info('='.repeat(120) + '\n');
  }
}

