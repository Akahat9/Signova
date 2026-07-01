import { render, screen } from '@testing-library/react';
import EncryptionStatusNotice from './EncryptionStatusNotice';

test('shows unavailable unless protocol and verified devices are present', () => {
  render(<EncryptionStatusNotice capability={{
    available: false,
    protocol: null,
    verifiedDevices: 0,
    reason: 'Local preview only.',
  }} />);

  expect(screen.getByText('E2EE unavailable')).toBeInTheDocument();
  expect(screen.getByText('End-to-end encryption is not active')).toBeInTheDocument();
});

test('shows active only for a verified E2EE session', () => {
  render(<EncryptionStatusNotice capability={{
    available: true,
    protocol: 'MLS 1.0',
    verifiedDevices: 2,
  }} />);

  expect(screen.getByText('E2EE active')).toBeInTheDocument();
  expect(screen.getByText(/MLS 1.0 protects this conversation/i)).toBeInTheDocument();
});
