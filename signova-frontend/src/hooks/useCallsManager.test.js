import { renderHook, act } from '@testing-library/react';
import useCallsManager from './useCallsManager';

jest.mock('../services/callSignaling', () => ({
  createCallRoom: jest.fn(),
  publishCallAnswer: jest.fn(),
  publishCallOffer: jest.fn(),
  publishIceCandidate: jest.fn(),
  setCallRoomStatus: jest.fn().mockResolvedValue(),
  watchCallRoom: jest.fn().mockReturnValue(() => {}),
  watchIncomingCalls: jest.fn().mockReturnValue(() => {}),
}));

describe('useCallsManager', () => {
  const defaultProps = {
    firestoreDb: null,
    authenticatedFirebaseUser: { uid: 'user-1', emailVerified: true },
    selectedChatContact: { id: 'contact-1', firebaseUid: 'user-2', name: 'Aarav' },
    settings: { translation: { language: 'en', mode: 'text', outputType: 'text' } },
    cameraEnabled: false,
    micEnabled: false,
    startCamera: jest.fn(),
    stopCamera: jest.fn(),
    startCameraRef: { current: jest.fn() },
    setMicEnabled: jest.fn(),
    updateSynapseEnabled: jest.fn(),
    synapseEnabledRef: { current: true },
    synapseEnabled: true,
    caption: 'Hello',
    sentence: 'Hello world',
    liveSign: { label: 'hello', confidence: 0.95 },
    streamRef: { current: null },
    videoRef: { current: null },
    remoteVideoRef: { current: null },
    speak: jest.fn(),
    voiceEnabledRef: { current: true },
    addTranscriptEntry: jest.fn(),
    startConversationLog: jest.fn(),
    completeActiveConversationLog: jest.fn(),
    clearSentence: jest.fn(),
    setStatus: jest.fn(),
    setSecureCallStatus: jest.fn(),
    updateSettingAndTrack: jest.fn(),
    setSelectedChatId: jest.fn(),
    setSelectedConversationId: jest.fn(),
    setMobileChatListOpen: jest.fn(),
    setActivePanel: jest.fn(),
    desktopCallWindowMode: false,
    SIGNOVA_CALL_TEST_MODE: true,
  };

  test('initializes with default call states', () => {
    const { result } = renderHook(() => useCallsManager(defaultProps));

    expect(result.current.callStatus).toBe('WebRTC ready');
    expect(result.current.chatCallScreen).toBeNull();
    expect(result.current.callElapsedSeconds).toBe(0);
    expect(result.current.chatCallMinimized).toBe(false);
  });

  test('formats call timer properly', () => {
    const { result } = renderHook(() => useCallsManager(defaultProps));

    expect(result.current.formatCallTimer(0)).toBe('00:00:00');
    expect(result.current.formatCallTimer(65)).toBe('00:01:05');
    expect(result.current.formatCallTimer(3665)).toBe('01:01:05');
  });

  test('resetWebRtcPreview resets call status and media states', () => {
    const { result } = renderHook(() => useCallsManager(defaultProps));

    act(() => {
      result.current.resetWebRtcPreview('Custom reset status');
    });

    expect(result.current.callStatus).toBe('Custom reset status');
    expect(result.current.remoteCaption).toBe('Waiting for remote caption');
  });
});
