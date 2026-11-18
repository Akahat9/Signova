import { fireEvent, render, screen } from '@testing-library/react';
import {
  AppStartupSkeleton,
  CommunityActionIcon,
  CommunityFeedVideo,
  ContactMetaLine,
  getCallHistoryPresentation,
  SignovaOpeningAnimation,
} from './AppPresentation';

test('repeated community actions receive collision-free SVG definition IDs', () => {
  const { container } = render(<><CommunityActionIcon type="like" /><CommunityActionIcon type="like" /></>);
  const ids = [...container.querySelectorAll('linearGradient')].map((node) => node.id);
  expect(ids).toHaveLength(2);
  expect(new Set(ids).size).toBe(2);
  container.querySelectorAll('svg').forEach((svg) => expect(svg).toHaveAttribute('aria-hidden', 'true'));
});

test('contact metadata respects privacy flags and exposes the current activity once', () => {
  render(<ContactMetaLine
    contact={{ username: '@private', number: '+911234', showUsername: false, showNumber: false }}
    activityItems={['Typing', 'Online']}
  />);
  expect(screen.queryByText('@private')).not.toBeInTheDocument();
  expect(screen.queryByText('+911234')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Typing')).toBeInTheDocument();
});

test('call-history presentation normalizes supported aliases and safe fallback text', () => {
  expect(getCallHistoryPresentation('VIDEO')).toEqual({ label: 'Video Sign Chat', tone: 'video', translation: 'Sign translation used' });
  expect(getCallHistoryPresentation('voiceMeeting')).toEqual({ label: 'Video Sign Chat', tone: 'video', translation: 'Sign translation used' });
  expect(getCallHistoryPresentation('unknown')).toEqual({ label: 'Normal Call', tone: 'normal', translation: 'No translation' });
});

test('startup feedback is announced while decorative opening motion stays hidden', () => {
  const { container } = render(<><AppStartupSkeleton /><SignovaOpeningAnimation activePanel="communityGroups" /></>);
  expect(screen.getByRole('status', { name: 'Loading your Signova workspace' })).toBeInTheDocument();
  expect(screen.getByText('Preparing your workspace…')).toBeInTheDocument();
  expect(container.querySelector('.fullSignovaIntro')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('.tributeIconCommunity .communityGroups')).toBeInTheDocument();
});

test('community videos pause outside the feed viewport and pause sibling playback', () => {
  let observerCallback;
  const disconnect = jest.fn();
  const observe = jest.fn();
  const pause = jest.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  window.IntersectionObserver = jest.fn((callback) => {
    observerCallback = callback;
    return { observe, disconnect };
  });

  const sibling = document.createElement('video');
  sibling.className = 'performanceCommunityVideo';
  document.body.appendChild(sibling);
  const { unmount } = render(<CommunityFeedVideo src="video.mp4" label="Community demo" />);
  const current = screen.getByLabelText('Community demo');

  observerCallback([{ isIntersecting: false, intersectionRatio: 0 }]);
  expect(pause).toHaveBeenCalledWith();
  fireEvent.play(current);
  expect(pause.mock.instances).toContain(sibling);

  unmount();
  expect(disconnect).toHaveBeenCalledTimes(1);
  sibling.remove();
  pause.mockRestore();
  delete window.IntersectionObserver;
});
