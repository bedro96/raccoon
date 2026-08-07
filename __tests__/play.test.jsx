import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, vi } from 'vitest';
import PlayPage from '../app/play/page.jsx';

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: false,
  }));
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('PlayPage', () => {
  it('renders a canvas element', () => {
    const { container } = render(<PlayPage />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(screen.getByText(/Lives:\s*3/)).toBeInTheDocument();
    expect(screen.getByText(/Score:\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
  });
});
