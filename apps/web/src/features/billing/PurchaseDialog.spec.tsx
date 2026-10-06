import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { redirectTo } from '@/lib/navigation';
import { renderWithProviders } from '@/test/render';
import { billingApi } from './api';
import { PurchaseDialog } from './PurchaseDialog';

vi.mock('./api', () => ({ billingApi: { checkout: vi.fn(), portal: vi.fn() } }));
vi.mock('@/lib/navigation', () => ({ redirectTo: vi.fn() }));

const checkout = vi.mocked(billingApi.checkout);
const bothPrices = { month: { amountMinor: 999, currency: 'usd' }, year: { amountMinor: 9900, currency: 'usd' } };
const apiError = (status: number) => new ApiRequestError(status, { statusCode: status, error: 'x', message: 'x' });

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

beforeEach(() => {
  checkout.mockReset();
  vi.mocked(redirectTo).mockReset();
});
afterEach(cleanup);

describe('PurchaseDialog', () => {
  it('is a disabled button when nothing is on sale', () => {
    renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung" prices={{ month: null, year: null }} />);

    expect(screen.getByRole('button', { name: 'Not on sale yet' })).toBeDisabled();
  });

  it('offers each interval that is on sale, with its price', () => {
    renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung opening" prices={bothPrices} />);

    open();
    const dialog = screen.getByRole('dialog', { name: 'Choose your plan' });

    expect(within(dialog).getByRole('button', { name: /Monthly.*\$9\.99 \/ month/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Yearly.*\$99\.00 \/ year/ })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Lung opening');
  });

  it('offers only the interval that is on sale', () => {
    renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung" prices={{ month: bothPrices.month, year: null }} />);

    open();

    expect(screen.getByRole('button', { name: /Monthly/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Yearly/ })).not.toBeInTheDocument();
  });

  it('sends a track purchase to checkout and then follows Stripe\'s page', async () => {
    checkout.mockResolvedValue({ url: 'https://checkout.stripe.test/c/1' });
    renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung" prices={bothPrices} />);

    open();
    fireEvent.click(screen.getByRole('button', { name: /Yearly/ }));

    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith('https://checkout.stripe.test/c/1'));
    expect(checkout.mock.calls[0]?.[0]).toEqual({ trackId: 't1', interval: 'YEAR' });
  });

  it('sends a program purchase with a program id', async () => {
    checkout.mockResolvedValue({ url: 'https://checkout.stripe.test/c/2' });
    renderWithProviders(<PurchaseDialog target={{ kind: 'PROGRAM', id: 'p1' }} title="Back" prices={bothPrices} />);

    open();
    fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));

    await waitFor(() => expect(checkout).toHaveBeenCalled());
    expect(checkout.mock.calls[0]?.[0]).toEqual({ programId: 'p1', interval: 'MONTH' });
  });

  it('shows that it is going to the payment page, and does not let the listener click twice', async () => {
    checkout.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung" prices={bothPrices} />);

    open();
    fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));

    expect(await screen.findByRole('status')).toHaveTextContent('secure payment page');
    expect(screen.getByRole('button', { name: /Monthly/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Yearly/ })).toBeDisabled();
  });

  it.each([
    [409, 'You already subscribe to this'],
    [503, 'temporarily unavailable'],
    [422, 'not available for purchase'],
    [500, 'Something went wrong'],
  ])('explains a %i to the listener and lets them try again', async (status, message) => {
    checkout.mockRejectedValueOnce(apiError(status));
    renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung" prices={bothPrices} />);

    open();
    fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(redirectTo).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Monthly/ })).toBeEnabled();
  });

  it('refreshes the library after a 409, since it must have been out of date', async () => {
    checkout.mockRejectedValue(apiError(409));
    const { client } = renderWithProviders(<PurchaseDialog target={{ kind: 'TRACK', id: 't1' }} title="Lung" prices={bothPrices} />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    open();
    fireEvent.click(screen.getByRole('button', { name: /Monthly/ }));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['library'] }));
  });
});
