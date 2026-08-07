import { render, screen } from '@testing-library/react';
import PlayPage from '../app/play/page.jsx';

describe('PlayPage', () => {
  it('renders a canvas element', () => {
    const { container } = render(<PlayPage />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});
