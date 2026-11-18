import { renderHook, act } from '@testing-library/react';
import useChatManager from './useChatManager';

describe('useChatManager', () => {
  const defaultProps = {
    contacts: [{ id: 'contact-1', name: 'Aarav' }],
    setContacts: jest.fn(),
    setMessages: jest.fn(),
    deleteUserDoc: jest.fn().mockResolvedValue(),
    attachmentUrlRegistryRef: { current: { releaseMessages: jest.fn() } },
    setStatus: jest.fn(),
    startVideoSignChat: jest.fn(),
    startVoiceSignChat: jest.fn(),
    setContactInfoOpen: jest.fn(),
    setGroupModalOpen: jest.fn(),
    setGroupCreationContext: jest.fn(),
    openPanel: jest.fn(),
    addEncryptedMessage: jest.fn(),
    setSelectedShareContactId: jest.fn(),
    speak: jest.fn(),
    settings: { translation: { outputType: 'text' } },
    liveSign: null,
  };

  test('initializes with default chat states', () => {
    const { result } = renderHook(() => useChatManager(defaultProps));

    expect(result.current.selectedChatId).toBe('signova-ai');
    expect(result.current.chatFilter).toBe('all');
    expect(result.current.chatDraft).toBe('');
    expect(result.current.chatHeaderMenuOpen).toBe(false);
  });

  test('toggles header menu', () => {
    const { result } = renderHook(() => useChatManager(defaultProps));

    act(() => {
      result.current.toggleHeaderMenu();
    });

    expect(result.current.chatHeaderMenuOpen).toBe(true);

    act(() => {
      result.current.toggleHeaderMenu();
    });

    expect(result.current.chatHeaderMenuOpen).toBe(false);
  });

  test('receipt label returns appropriate status checks', () => {
    const { result } = renderHook(() => useChatManager(defaultProps));

    expect(result.current.messageReceiptLabel({ direction: 'incoming' })).toBe('');
    expect(result.current.messageReceiptLabel({ direction: 'outgoing', status: 'read' })).toBe('✓✓');
    expect(result.current.messageReceiptLabel({ direction: 'outgoing', status: 'delivered' })).toBe('✓✓');
    expect(result.current.messageReceiptLabel({ direction: 'outgoing', status: 'sending' })).toBe('◌');
    expect(result.current.messageReceiptLabel({ direction: 'outgoing', status: 'sent' })).toBe('✓');
  });

  test('closeMessageMiniWindows closes all reaction and tool windows', () => {
    const { result } = renderHook(() => useChatManager(defaultProps));

    act(() => {
      result.current.openReactionWindow(null, 'msg-1');
    });
    expect(result.current.reactionMessageId).toBe('msg-1');

    act(() => {
      result.current.closeMessageMiniWindows();
    });
    expect(result.current.reactionMessageId).toBe('');
    expect(result.current.toolMessageId).toBe('');
  });
});

