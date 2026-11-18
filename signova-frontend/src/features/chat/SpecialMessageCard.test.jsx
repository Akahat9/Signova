import { fireEvent, render, screen } from '@testing-library/react';
import SpecialMessageCard from './SpecialMessageCard';

const callbacks = {
  onEditContact: jest.fn(),
  onAddContact: jest.fn(),
  onVotePoll: jest.fn(),
  onEditMeet: jest.fn(),
  onSaveMeetDetail: jest.fn(),
  onAudioSpeedChange: jest.fn(),
};

beforeEach(() => Object.values(callbacks).forEach((callback) => callback.mockClear()));

test('renders expired local document previews with truthful disabled actions', () => {
  render(<SpecialMessageCard {...callbacks} message={{
    attachmentType: 'document',
    attachmentData: { title: 'report.pdf', fileType: 'application/pdf', size: '1 MB', previewExpired: true, url: '' },
  }} />);
  expect(screen.getByText('local preview expired', { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preview unavailable' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Download unavailable' })).toBeDisabled();
  expect(screen.queryByText(/secure attachment/i)).not.toBeInTheDocument();
});

test('renders resumable attachment upload progress and cancel action', () => {
  render(<SpecialMessageCard {...callbacks} onCancelAttachmentUpload={callbacks.onEditMeet} message={{
    attachmentType: 'image',
    attachmentData: { title: 'photo.png', quality: 'High quality', uploadStage: 'uploading', uploadProgress: 42, url: 'blob:image' },
  }} />);
  expect(screen.getByRole('status', { name: 'Attachment upload progress' })).toHaveTextContent('Uploading 42%');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(callbacks.onEditMeet).toHaveBeenCalledTimes(1);
});

test('poll choices expose vote totals and invoke the selected index', () => {
  render(<SpecialMessageCard {...callbacks} message={{
    attachmentType: 'poll',
    attachmentData: { title: 'Choose', options: ['A', 'B'], votes: [1, 3] },
  }} />);
  fireEvent.click(screen.getByRole('button', { name: /2\. B/ }));
  expect(callbacks.onVotePoll).toHaveBeenCalledWith(1);
  expect(screen.getByText('4 audience responses collected')).toBeInTheDocument();
});

test('contact and meet cards route actions according to message direction', () => {
  const { rerender } = render(<SpecialMessageCard {...callbacks} isOutgoing message={{
    attachmentType: 'contact', attachmentData: { title: 'Asha', username: '@asha' },
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(callbacks.onEditContact).toHaveBeenCalledTimes(1);

  rerender(<SpecialMessageCard {...callbacks} isOutgoing={false} message={{
    attachmentType: 'meet', attachmentData: { title: 'Practice', date: 'Today', time: '18:00', reminder: '10 min' },
  }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
  expect(callbacks.onSaveMeetDetail).toHaveBeenCalledWith('calendar');
});
