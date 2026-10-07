import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { PriceEditor } from './PriceEditor';

afterEach(cleanup);

const prices = { month: { amountMinor: 999, currency: 'usd' }, year: null };
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Save prices' }));

describe('PriceEditor', () => {
  it('starts from the current prices, with an empty field for an interval that is off sale', () => {
    render(<PriceEditor prices={prices} onSave={vi.fn()} />);

    expect(screen.getByLabelText('Monthly price')).toHaveValue('9.99');
    expect(screen.getByLabelText('Yearly price')).toHaveValue('');
  });

  it('saves dollars as minor units, and a blank field as off sale', async () => {
    const onSave = vi.fn().mockResolvedValue({});
    render(<PriceEditor prices={prices} onSave={onSave} />);

    type('Monthly price', '12.50');
    type('Yearly price', '');
    submit();

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ monthlyAmountMinor: 1250, yearlyAmountMinor: null }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
  });

  it('does not save an amount the server would refuse, and marks the field', () => {
    const onSave = vi.fn();
    render(<PriceEditor prices={prices} onSave={onSave} />);

    type('Monthly price', '0.10');
    submit();

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Monthly price')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Yearly price')).not.toHaveAttribute('aria-invalid');
  });

  it('says so when payments are not configured', async () => {
    render(
      <PriceEditor
        prices={prices}
        onSave={vi.fn().mockRejectedValue(new ApiRequestError(503, null))}
      />,
    );

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Payments are not configured yet');
  });

  it("shows the server's own reason for a rule violation", async () => {
    const error = new ApiRequestError(422, {
      statusCode: 422,
      error: 'x',
      message: 'Price is too low',
    });
    render(<PriceEditor prices={prices} onSave={vi.fn().mockRejectedValue(error)} />);

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Price is too low');
  });
});
