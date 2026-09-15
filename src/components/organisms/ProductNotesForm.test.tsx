import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { ProductNotesForm } from './ProductNotesForm'
import { updateProduct } from '@/actions/products'

vi.mock('@/actions/products', () => ({
  createProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
  addProductPhoto: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateProduct: vi.fn().mockResolvedValue({ data: {}, error: null }),
}))

describe('ProductNotesForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders textarea with initial notes value', () => {
    render(<ProductNotesForm productId="abc" initialNotes="existing note" />)
    const textarea = screen.getByPlaceholderText('Add notes about this product…')
    expect(textarea).toHaveValue('existing note')
  })

  it('calls updateProduct with productId and notes on save', async () => {
    render(<ProductNotesForm productId="abc" initialNotes="existing note" />)

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(updateProduct).toHaveBeenCalledWith('abc', {
        notes: 'existing note',
        brand_id: null,
        product_type_id: null,
      })
    })
  })

  it('displays error message when updateProduct returns an error', async () => {
    vi.mocked(updateProduct).mockResolvedValueOnce({ data: null, error: { message: 'Permission denied' } })

    render(<ProductNotesForm productId="abc" initialNotes="existing note" />)

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument()
    })
  })

  it('renders Notes label', () => {
    render(<ProductNotesForm productId="abc" initialNotes="" />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })
})
