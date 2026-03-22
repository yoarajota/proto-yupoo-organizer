import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductPhotoStrip } from './ProductPhotoStrip'

const photos = [
  { id: '1', storage_path: 'a.jpg', alt_text: 'Photo A' },
  { id: '2', storage_path: 'b.jpg', alt_text: 'Photo B' },
  { id: '3', storage_path: 'c.jpg', alt_text: 'Photo C' },
]
const supabaseUrl = 'https://test.supabase.co'

describe('ProductPhotoStrip', () => {
  it('renders 3 thumbnails when given 3 photos', () => {
    render(<ProductPhotoStrip photos={photos} supabaseUrl={supabaseUrl} />)
    expect(screen.getByAltText('Photo A')).toBeInTheDocument()
    expect(screen.getByAltText('Photo B')).toBeInTheDocument()
    expect(screen.getByAltText('Photo C')).toBeInTheDocument()
  })

  it('renders "No photos yet." when given 0 photos', () => {
    render(<ProductPhotoStrip photos={[]} supabaseUrl={supabaseUrl} />)
    expect(screen.getByText('No photos yet.')).toBeInTheDocument()
  })

  it('opens lightbox with counter "1 / 3" when first thumbnail is clicked', () => {
    render(<ProductPhotoStrip photos={photos} supabaseUrl={supabaseUrl} />)
    fireEvent.click(screen.getByAltText('Photo A'))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('navigates to last photo (3 / 3) when → is clicked from first photo', () => {
    render(<ProductPhotoStrip photos={photos} supabaseUrl={supabaseUrl} />)
    fireEvent.click(screen.getByAltText('Photo A'))
    fireEvent.click(screen.getByLabelText('Previous photo'))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('navigates to next photo (2 / 3) when → is clicked from first photo', () => {
    render(<ProductPhotoStrip photos={photos} supabaseUrl={supabaseUrl} />)
    fireEvent.click(screen.getByAltText('Photo A'))
    fireEvent.click(screen.getByLabelText('Next photo'))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })
})
