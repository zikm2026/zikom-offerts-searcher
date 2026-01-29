import { CustomError } from '@middleware/errorHandler';
import logger from '@utils/logger';

interface ExampleData {
  id: string;
  name: string;
  createdAt: Date;
}

class ExampleService {
  async getExampleById(id: string): Promise<ExampleData> {
    logger.debug(`Fetching example with id: ${id}`);

    if (id === 'invalid') {
      throw new CustomError('Example not found', 404);
    }

    return {
      id,
      name: 'Example',
      createdAt: new Date(),
    };
  }

  async createExample(data: Partial<ExampleData>): Promise<ExampleData> {
    logger.debug('Creating new example', data);

    if (!data.name) {
      throw new CustomError('Name is required', 400);
    }

    return {
      id: Math.random().toString(36).substring(7),
      name: data.name,
      createdAt: new Date(),
    };
  }
}

export default new ExampleService();

