import { formatMetricPercent, formatPracticeTime, radarPolygonPoints, toPointArray } from './progressPresentation';

test('formats progress metrics and time safely', () => {
  expect(formatMetricPercent(0.925)).toBe('92.5%');
  expect(formatMetricPercent(undefined)).toBe('N/A');
  expect(formatPracticeTime(125)).toBe('2h 5m');
  expect(formatPracticeTime(-1)).toBe('0m');
});

test('builds bounded radar and landmark coordinates', () => {
  expect(radarPolygonPoints([100, 50, -10])).toContain('100,24');
  expect(toPointArray([{ x: 1, y: 2 }, { x: 3, y: 4, z: 5 }])).toEqual([[1, 2, 0], [3, 4, 5]]);
});

