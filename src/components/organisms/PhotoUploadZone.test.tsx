import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { PhotoUploadZone } from './PhotoUploadZone'
import { addProductPhoto, createProduct } from '@/actions/products'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
      })),
    },
  })),
}))

vi.mock('@/actions/products', () => ({
  createProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
  addProductPhoto: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
}))

describe('PhotoUploadZone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload zone container and instructional text', () => {
    render(<PhotoUploadZone />)
    expect(screen.getByText('Drop photos here or click to select')).toBeInTheDocument()
  })

  it('clicking zone triggers file input click', () => {
    render(<PhotoUploadZone />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})

    const zone = screen.getByText('Drop photos here or click to select').closest('div')!
    fireEvent.click(zone)

    expect(clickSpy).toHaveBeenCalled()
  })

  it('calls addProductPhoto (not createProduct) when productId is provided', async () => {
    render(<PhotoUploadZone productId="test-product-id" />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(addProductPhoto).toHaveBeenCalledWith(
        'test-product-id',
        expect.stringContaining('products/'),
        'photo.jpg',
      )
      expect(createProduct).not.toHaveBeenCalled()
    })
  })

  it('calls createProduct (not addProductPhoto) when no productId', async () => {
    render(<PhotoUploadZone />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['test'], 'photo.jpg', { type: 'image/jpeg' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalled()
      expect(addProductPhoto).not.toHaveBeenCalled()
    })
  })
})
