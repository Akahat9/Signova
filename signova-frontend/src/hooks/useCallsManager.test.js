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

  test('endCallSession sends hangup over open data channel, updates room status, and closes call screen', async () => {
    const { setCallRoomStatus } = require('../services/callSignaling');
    setCallRoomStatus.mockResolvedValue(undefined);
    const mockDb = { name: 'mock-db' };
    const sendMock = jest.fn();
    const closeMock = jest.fn();
    const { result } = renderHook(() => useCallsManager({ ...defaultProps, firestoreDb: mockDb }));

    act(() => {
      result.current.setChatCallScreen('video');
      result.current.activeCallRoomIdRef.current = 'room-123';
      result.current.captionChannelRef.current = { readyState: 'open', send: sendMock, close: closeMock };
    });

    await act(async () => {
      await result.current.endCallSession();
    });

    expect(sendMock).toHaveBeenCalledWith(expect.stringContaining('"type":"signova-call-hangup"'));
    expect(setCallRoomStatus).toHaveBeenCalledWith(mockDb, 'room-123', 'ended');
    expect(result.current.chatCallScreen).toBeNull();
    expect(result.current.callStatus).toBe('Call ended');
  });

  test('handleRemoteTerminalCall closes active call screen and clears incoming call', () => {
    const { result } = renderHook(() => useCallsManager(defaultProps));

    act(() => {
      result.current.setChatCallScreen('video');
      result.current.setIncomingCall({ id: 'room-456', callerUid: 'user-2', mediaType: 'video' });
    });

    act(() => {
      result.current.handleRemoteTerminalCall('ended');
    });

    expect(result.current.chatCallScreen).toBeNull();
    expect(result.current.incomingCall).toBeNull();
    expect(result.current.callStatus).toBe('Call ended');
    expect(defaultProps.completeActiveConversationLog).toHaveBeenCalled();
  });

  test('rejectIncomingCall clears incoming call, completes active log, and sets rejected status', async () => {
    const { setCallRoomStatus } = require('../services/callSignaling');
    setCallRoomStatus.mockResolvedValue(undefined);
    const completeLog = jest.fn();
    const mockDb = { name: 'mock-db' };
    const { result } = renderHook(() => useCallsManager({
      ...defaultProps,
      firestoreDb: mockDb,
      completeActiveConversationLog: completeLog,
    }));

    act(() => {
      result.current.setIncomingCall({ id: 'room-789', callerUid: 'user-2', mediaType: 'video' });
    });

    await act(async () => {
      await result.current.rejectIncomingCall();
    });

    expect(setCallRoomStatus).toHaveBeenCalledWith(mockDb, 'room-789', 'rejected');
    expect(result.current.incomingCall).toBeNull();
    expect(result.current.chatCallScreen).toBeNull();
    expect(completeLog).toHaveBeenCalled();
  });
});
