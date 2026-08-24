import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useProfileData } from '../useProfileData';
import { profileApi } from '@/api';
import type { Address, PaymentMethod } from '@/types';

jest.mock('@/api', () => ({
  profileApi: { listAddresses: jest.fn(), listPaymentMethods: jest.fn() },
  toUserMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
}));

const mockApi = profileApi as jest.Mocked<typeof profileApi>;

const ADDRESS: Address = {
  id: 'a1',
  label: 'Home',
  recipientName: null,
  phone: null,
  line1: '123 Main St',
  line2: null,
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94105',
  primary: true,
};

const CARD: PaymentMethod = {
  id: 'p1',
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2030,
  primary: true,
};

describe('useProfileData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi.listAddresses.mockResolvedValue([ADDRESS]);
    mockApi.listPaymentMethods.mockResolvedValue([CARD]);
  });

  it('loads addresses and saved cards together', async () => {
    const { result } = await renderHook(() => useProfileData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.addresses).toEqual([ADDRESS]);
    expect(result.current.paymentMethods).toEqual([CARD]);
    expect(result.current.error).toBeNull();
  });

  it('reports an error rather than spinning forever', async () => {
    mockApi.listAddresses.mockRejectedValue(new Error('Could not reach the server.'));

    const { result } = await renderHook(() => useProfileData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Could not reach the server.');
  });

  it('reload re-fetches, so the screen shows what the server actually stored', async () => {
    const { result } = await renderHook(() => useProfileData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockApi.listAddresses.mockResolvedValue([ADDRESS, { ...ADDRESS, id: 'a2', primary: false }]);

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.addresses).toHaveLength(2));
    expect(mockApi.listAddresses).toHaveBeenCalledTimes(2);
  });

  it('clears a previous error on a successful reload', async () => {
    mockApi.listPaymentMethods.mockRejectedValueOnce(new Error('boom'));

    const { result } = await renderHook(() => useProfileData());
    await waitFor(() => expect(result.current.error).toBe('boom'));

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
