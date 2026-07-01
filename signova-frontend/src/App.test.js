import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeAll(() => {
  window.matchMedia = window.matchMedia || (() => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

test('renders Signova workspace', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.getByLabelText(/Signova app navigation/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Community' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Signova community dashboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/Private preview: messages are protected/i)).not.toBeInTheDocument();
  });
});
