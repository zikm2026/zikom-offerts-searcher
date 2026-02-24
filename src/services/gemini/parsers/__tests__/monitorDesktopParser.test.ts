import { parseMonitorResponse, parseDesktopResponse } from '../monitorDesktopParser';

describe('monitorDesktopParser', () => {
  describe('parseMonitorResponse', () => {
    it('parses valid JSON with monitors array', () => {
      const text = `\`\`\`json
{
  "monitors": [
    { "model": "Dell P2422H", "sizeInches": 24, "resolution": "1920x1080", "price": "150 EUR" }
  ],
  "totalPrice": "150 EUR",
  "totalQuantity": 1
}
\`\`\``;
      const result = parseMonitorResponse(text);
      expect(result.monitors).toHaveLength(1);
      expect(result.monitors[0].model).toBe('Dell P2422H');
      expect(result.monitors[0].sizeInches).toBe(24);
      expect(result.monitors[0].resolution).toBe('1920x1080');
      expect(result.monitors[0].price).toBe('150 EUR');
      expect(result.totalQuantity).toBe(1);
    });

    it('extracts amount when present and > 0', () => {
      const text = `{"monitors":[{"sizeInches":27,"resolution":"2560x1440","price":"3000 EUR","amount":30}],"totalQuantity":30}`;
      const result = parseMonitorResponse(text);
      expect(result.monitors).toHaveLength(1);
      expect(result.monitors[0].amount).toBe(30);
    });

    it('ignores amount when 0 or not a number', () => {
      const text = `{"monitors":[{"sizeInches":24,"price":"100","amount":0},{"sizeInches":27,"price":"200","amount":"x"}],"totalQuantity":2}`;
      const result = parseMonitorResponse(text);
      expect(result.monitors[0].amount).toBeUndefined();
      expect(result.monitors[1].amount).toBeUndefined();
    });

    it('returns empty monitors and totalQuantity 0 on invalid JSON', () => {
      const result = parseMonitorResponse('not json at all');
      expect(result.monitors).toEqual([]);
      expect(result.totalQuantity).toBe(0);
    });

    it('handles missing monitors key as empty array', () => {
      const result = parseMonitorResponse('{"totalPrice":"100"}');
      expect(result.monitors).toEqual([]);
    });

    it('uses totalQuantity from response or falls back to monitors.length', () => {
      const text = `{"monitors":[{"sizeInches":24},{"sizeInches":27}],"totalQuantity":5}`;
      const result = parseMonitorResponse(text);
      expect(result.totalQuantity).toBe(5);
    });
  });

  describe('parseDesktopResponse', () => {
    it('parses valid JSON with desktops array', () => {
      const text = `{
        "desktops": [
          { "model": null, "caseType": "Tower", "ram": "32 GB", "storage": "2 TB", "price": "300 EUR" }
        ],
        "totalPrice": "300 EUR",
        "totalQuantity": 1
      }`;
      const result = parseDesktopResponse(text);
      expect(result.desktops).toHaveLength(1);
      expect(result.desktops[0].caseType).toBe('Tower');
      expect(result.desktops[0].ram).toBe('32 GB');
      expect(result.desktops[0].storage).toBe('2 TB');
      expect(result.desktops[0].price).toBe('300 EUR');
      expect(result.totalQuantity).toBe(1);
    });

    it('extracts amount when present and > 0', () => {
      const text = `{"desktops":[{"caseType":"SFF","ram":"16 GB","storage":"1TB","price":"5000","amount":10}],"totalQuantity":10}`;
      const result = parseDesktopResponse(text);
      expect(result.desktops).toHaveLength(1);
      expect(result.desktops[0].amount).toBe(10);
    });

    it('ignores amount when 0 or not a number', () => {
      const text = `{"desktops":[{"caseType":"Tower","amount":0}]}`;
      const result = parseDesktopResponse(text);
      expect(result.desktops[0].amount).toBeUndefined();
    });

    it('returns empty desktops and totalQuantity 0 on invalid JSON', () => {
      const result = parseDesktopResponse('invalid');
      expect(result.desktops).toEqual([]);
      expect(result.totalQuantity).toBe(0);
    });

    it('handles missing desktops key as empty array', () => {
      const result = parseDesktopResponse('{}');
      expect(result.desktops).toEqual([]);
    });
  });
});
