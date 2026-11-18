import { render } from '@testing-library/react';
import { Attach3DIcon, RailIcon } from './SignovaIcons';

test('renders attachment icons as decorative SVG without exposing duplicate labels', () => {
  const { container } = render(<Attach3DIcon type="camera" />);
  const wrapper = container.querySelector('.attachIcon3d-camera');
  expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  expect(wrapper.querySelector('svg')).toHaveAttribute('focusable', 'false');
});

test('renders known navigation icon variants and keeps them decorative', () => {
  const { container } = render(<RailIcon type="library" />);
  const wrapper = container.querySelector('.railIcon3d.library');
  expect(wrapper).toHaveAttribute('aria-hidden', 'true');
  expect(wrapper.querySelector('.libraryBookStack')).toBeInTheDocument();
});

test('uses unique gradient identifiers across repeated icon instances', () => {
  const { container } = render(<><RailIcon type="settings" /><RailIcon type="settings" /></>);
  const gradientIds = [...container.querySelectorAll('linearGradient')].map((node) => node.id);
  expect(new Set(gradientIds).size).toBe(gradientIds.length);
});

test('falls back to a stable glyph for unsupported attachment and rail variants', () => {
  const { container } = render(<><Attach3DIcon type="unknown" /><RailIcon type="unknown" /></>);
  expect(container.querySelector('.attachIcon3d-unknown svg')).toBeInTheDocument();
  expect(container.querySelector('.railIcon3d.unknown svg')).toBeInTheDocument();
});
