import {
  parseExcelResponse,
  parseEmailContentResponse,
} from '../parsers/excelDataParser';

describe('gemini excelDataParser', () => {
  describe('parseExcelResponse', () => {
    it('parses valid JSON with laptops array', () => {
      const text = `{
        "laptops": [
          { "model": "Dell 7430", "ram": "16 GB", "storage": "512 GB", "price": "400 EUR", "graphicsCard": "Iris Xe" }
        ],
        "grade": "A",
        "totalPrice": "400 EUR",
        "totalQuantity": 1
      }`;
      const result = parseExcelResponse(text);
      expect(result.laptops).toHaveLength(1);
      expect(result.laptops[0].model).toBe('Dell 7430');
      expect(result.laptops[0].ram).toBe('16 GB');
      expect(result.laptops[0].price).toBe('400 EUR');
      expect(result.grade).toBe('A');
      expect(result.totalQuantity).toBe(1);
    });

    it('returns empty laptops on invalid JSON', () => {
      const result = parseExcelResponse('not json at all');
      expect(result.laptops).toHaveLength(0);
      expect(result.totalQuantity).toBe(0);
    });

    it('normalizes null price from Gemini', () => {
      const text = `{"laptops": [{"model": "X", "ram": "8 GB", "storage": "256 GB", "price": "null"}]}`;
      const result = parseExcelResponse(text);
      expect(result.laptops[0].price).toBeUndefined();
    });

    it('parses amount per laptop when present and > 0', () => {
      const text = `{
        "laptops": [
          { "model": "Dell 7430", "ram": "16 GB", "storage": "512 GB", "price": "400 EUR", "amount": 10 }
        ],
        "totalQuantity": 10
      }`;
      const result = parseExcelResponse(text);
      expect(result.laptops).toHaveLength(1);
      expect(result.laptops[0].amount).toBe(10);
      expect(result.totalQuantity).toBe(10);
    });

    it('omits amount when 0 or invalid', () => {
      const text = `{"laptops":[{"model":"X","ram":"8 GB","storage":"256 GB","price":"100 EUR","amount":0},{"model":"Y","amount":"n/a"}]}`;
      const result = parseExcelResponse(text);
      expect(result.laptops[0].amount).toBeUndefined();
      expect(result.laptops[1].amount).toBeUndefined();
    });

    it('repairs truncated JSON (missing closing ] and })', () => {
      const truncated = `{"laptops":[{"model":"Dell 7430","ram":"16 GB","storage":"512 GB","price":"400 EUR"}`;
      const result = parseExcelResponse(truncated);
      expect(result.laptops).toHaveLength(1);
      expect(result.laptops[0].model).toBe('Dell 7430');
    });

    it('repairs trailing comma before ]', () => {
      const withTrailingComma = `{"laptops":[{"model":"X","ram":"8 GB","storage":"256 GB"},]}`;
      const result = parseExcelResponse(withTrailingComma);
      expect(result.laptops).toHaveLength(1);
      expect(result.laptops[0].model).toBe('X');
    });
  });

  describe('parseEmailContentResponse', () => {
    it('delegates to parseExcelResponse with same shape', () => {
      const text = `{"laptops": [{"model": "ThinkPad", "ram": "16 GB", "storage": "512 GB", "price": "800 EUR"}], "totalQuantity": 1}`;
      const result = parseEmailContentResponse(text);
      expect(result.laptops).toHaveLength(1);
      expect(result.laptops[0].model).toBe('ThinkPad');
    });
  });
});
