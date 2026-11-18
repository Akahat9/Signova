import { render, screen, waitFor } from '@testing-library/react';
import AppErrorBoundary from './AppErrorBoundary';
import { reportClientError } from '../services/clientErrorReporter';

jest.mock('../services/clientErrorReporter', () => ({ reportClientError: jest.fn(() => Promise.resolve(true)) }));

function CrashingView() {
  throw new TypeError('Sensitive render details');
}

test('replaces a crashed view with an accessible recovery action and reports metadata', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  render(<AppErrorBoundary><CrashingView /></AppErrorBoundary>);
  expect(screen.getByRole('alert')).toHaveTextContent('Signova needs to restart this view');
  expect(screen.getByRole('button', { name: 'Reload Signova' })).toBeInTheDocument();
  await waitFor(() => expect(reportClientError).toHaveBeenCalledWith(
    expect.any(TypeError),
    expect.objectContaining({ source: 'react_boundary' }),
  ));
  consoleSpy.mockRestore();
});
