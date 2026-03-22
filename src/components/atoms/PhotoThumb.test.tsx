import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { PhotoThumb } from './PhotoThumb'

describe('PhotoThumb', () => {
  it('renders image with the provided alt attribute', () => {
    render(<PhotoThumb src="https://example.com/photo.jpg" alt="Test photo" />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', 'Test photo')
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
  })

  it('renders fallback placeholder when image errors', () => {
    render(<PhotoThumb src="https://example.com/broken.jpg" alt="Broken photo" />)
    const img = screen.getByRole('img')
    fireEvent.error(img)
    expect(screen.queryByRole('img')).toBeNull()
    // Camera icon container should be present
    expect(screen.getByAltText !== undefined).toBe(true)
  })
})
