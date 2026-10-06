import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CoverImage } from './cover-image';

afterEach(cleanup);

describe('CoverImage', () => {
  it('shows the image', () => {
    const { container } = render(<CoverImage url="https://cdn/c.png" />);

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn/c.png');
  });

  it('shows a placeholder when there is no image', () => {
    const { container } = render(<CoverImage url={null} className="size-10" />);

    expect(container.querySelector('img')).toBeNull();
    expect(container.firstElementChild).toHaveClass('size-10');
  });

  it('falls back to the placeholder when the image cannot be loaded, instead of a broken icon', () => {
    const { container } = render(<CoverImage url="https://cdn/gone.png" />);

    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    expect(container.querySelector('img')).toBeNull();
  });

  it('tries a new image after a failed one', () => {
    const { container, rerender } = render(<CoverImage url="https://cdn/gone.png" />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);

    rerender(<CoverImage url="https://cdn/fresh.png" />);

    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn/fresh.png');
  });
});
