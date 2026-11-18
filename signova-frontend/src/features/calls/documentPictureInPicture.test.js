import {
  isDocumentPiPSupported,
  copyStylesToTargetDocument,
  requestDocumentPiP,
  closeActiveDocumentPiP,
} from './documentPictureInPicture';

describe('documentPictureInPicture', () => {
  const originalDocPiP = window.documentPictureInPicture;

  afterEach(() => {
    window.documentPictureInPicture = originalDocPiP;
  });

  test('detects whether Document PiP is supported', () => {
    window.documentPictureInPicture = undefined;
    expect(isDocumentPiPSupported()).toBe(false);

    window.documentPictureInPicture = { requestWindow: jest.fn() };
    expect(isDocumentPiPSupported()).toBe(true);
  });

  test('throws if requestDocumentPiP is called when unsupported', async () => {
    delete window.documentPictureInPicture;
    await expect(requestDocumentPiP()).rejects.toThrow('Document Picture-in-Picture is not supported');
  });

  test('successfully opens PiP window and copies styles', async () => {
    const mockPipWindow = {
      document: {
        head: { appendChild: jest.fn() },
        body: { className: '' },
        createElement: jest.fn(() => ({
          appendChild: jest.fn(),
          rel: '',
          href: '',
        })),
        createTextNode: jest.fn((txt) => txt),
      },
      addEventListener: jest.fn(),
      close: jest.fn(),
    };

    window.documentPictureInPicture = {
      requestWindow: jest.fn().mockResolvedValue(mockPipWindow),
      window: null,
    };

    const onClose = jest.fn();
    const pipWin = await requestDocumentPiP({ width: 480, height: 280, onClose });

    expect(window.documentPictureInPicture.requestWindow).toHaveBeenCalledWith({ width: 480, height: 280 });
    expect(mockPipWindow.addEventListener).toHaveBeenCalledWith('pagehide', onClose, { once: true });
    expect(pipWin).toBe(mockPipWindow);
  });

  test('closeActiveDocumentPiP closes existing window', () => {
    const closeFn = jest.fn();
    window.documentPictureInPicture = {
      requestWindow: jest.fn(),
      window: { close: closeFn },
    };
    closeActiveDocumentPiP();
    expect(closeFn).toHaveBeenCalled();
  });

  test('copyStylesToTargetDocument gracefully handles empty doc', () => {
    expect(() => copyStylesToTargetDocument(null)).not.toThrow();
  });
});
