import { renderHook, act } from '@testing-library/react';
import useMobileDeviceBlock, { isMobileDevice } from './useMobileDeviceBlock';

describe('useMobileDeviceBlock', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('returns false in test environment by default', () => {
    expect(isMobileDevice()).toBe(false);
    const { result } = renderHook(() => useMobileDeviceBlock());
    expect(result.current.isMobileBlocked).toBe(false);
  });

  test('allows proceeding anyway via proceedAnyway callback', () => {
    const { result } = renderHook(() => useMobileDeviceBlock());
    act(() => {
      result.current.proceedAnyway();
    });
    expect(sessionStorage.getItem('signova_mobile_bypass')).toBe('true');
    expect(result.current.isMobileBlocked).toBe(false);
  });
});

