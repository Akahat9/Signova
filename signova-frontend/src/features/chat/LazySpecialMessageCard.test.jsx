import { render, screen } from '@testing-library/react';
import LazySpecialMessageCard from './LazySpecialMessageCard';

test('provides an accessible fallback and resolves the attachment chunk', async () => {
  render(<LazySpecialMessageCard message={{
    attachmentType: 'sticker',
    attachmentData: { title: 'Hello wave', note: 'Friendly greeting' },
  }} />);
  expect(screen.getByRole('status', { name: 'Loading attachment preview' })).toBeInTheDocument();
  expect(await screen.findByText('Hello wave')).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Loading attachment preview' })).not.toBeInTheDocument();
});
