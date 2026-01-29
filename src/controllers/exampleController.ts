import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { CustomError } from '@middleware/errorHandler';
import exampleService from '@services/exampleService';
import { ApiResponse } from '../types/index';

export const getExample = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!id) {
      throw new CustomError('ID is required', 400);
    }

    const data = await exampleService.getExampleById(id);

    const response: ApiResponse = {
      success: true,
      data,
    };

    res.status(200).json(response);
  }
);

export const createExample = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const exampleData = req.body;

    if (!exampleData) {
      throw new CustomError('Data is required', 400);
    }

    const data = await exampleService.createExample(exampleData);

    const response: ApiResponse = {
      success: true,
      data,
    };

    res.status(201).json(response);
  }
);

