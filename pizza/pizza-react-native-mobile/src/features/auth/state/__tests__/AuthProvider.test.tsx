import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { AuthProvider, useAuth } from '../AuthProvider';
import { authApi, ApiError } from '@/api';
import { tokenStore } from '@/storage';
import type { AuthenticationResponse, User } from '@/types';

jest.mock('@/api', () => {
  const actual = jest.requireActual('@/api/apiError');
  return {
    authApi: { login: jest.fn(), register: jest.fn(), me: jest.fn() },
    ApiError: actual.ApiError,
    toUserMessage: actual.toUserMessage,
  };
});

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

const USER: User = {
  id: 'user-1',
  email: 'customer@pizza.test',
  fullName: 'Test Customer',
  role: 'CUSTOMER',
  createdAt: '2026-08-01T00:00:00Z',
};

const SESSION: AuthenticationResponse = { token: 'jwt-abc', expiresInMinutes: 60, user: USER };

function Harness() {
  const { user, isAuthenticated, initialising, error, fieldErrors, login, logout } = useAuth();
  return (
    <>
      <Text testID="initialising">{String(initialising)}</Text>
      <Text testID="authed">{String(isAuthenticated)}</Text>
      <Text testID="email">{user?.email ?? '-'}</Text>
      <Text testID="error">{error ?? '-'}</Text>
      <Text testID="emailError">{fieldErrors['email'] ?? '-'}</Text>
      <Pressable testID="login" onPress={() => void login('a@b.test', 'pw').catch(() => {})}>
        <Text>login</Text>
      </Pressable>
      <Pressable testID="logout" onPress={() => void logout()}>
        <Text>logout</Text>
      </Pressable>
    </>
  );
}

const renderAuth = () =>
  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );

describe('AuthProvider', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.clear();
  });

  it('finishes initialising as signed out when the keychain is empty', async () => {
    await renderAuth();

    await waitFor(() => expect(screen.getByTestId('initialising')).toHaveTextContent('false'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    // No point asking the API who we are without a token.
    expect(mockAuthApi.me).not.toHaveBeenCalled();
  });

  it('validates a stored token against the API rather than trusting it', async () => {
    await tokenStore.set('jwt-abc');
    mockAuthApi.me.mockResolvedValue(USER);

    await renderAuth();

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    expect(mockAuthApi.me).toHaveBeenCalled();
    expect(screen.getByTestId('email')).toHaveTextContent('customer@pizza.test');
  });

  it('drops a token the API rejects, instead of leaving a dead session', async () => {
    await tokenStore.set('expired');
    mockAuthApi.me.mockRejectedValue(new ApiError(401, 'Unauthorized', null));

    await renderAuth();

    await waitFor(() => expect(screen.getByTestId('initialising')).toHaveTextContent('false'));
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    await expect(tokenStore.get()).resolves.toBeNull();
  });

  it('stores the token in the keychain on a successful login', async () => {
    mockAuthApi.login.mockResolvedValue(SESSION);

    await renderAuth();
    await waitFor(() => expect(screen.getByTestId('initialising')).toHaveTextContent('false'));

    await fireEvent.press(screen.getByTestId('login'));

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    await expect(tokenStore.get()).resolves.toBe('jwt-abc');
  });

  it('surfaces the API message and its field errors on a failed login', async () => {
    mockAuthApi.login.mockRejectedValue(
      new ApiError(401, 'Invalid email or password', {
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        path: '/api/auth/login',
        timestamp: '',
        errors: [{ field: 'email', message: 'unknown account' }],
      }),
    );

    await renderAuth();
    await waitFor(() => expect(screen.getByTestId('initialising')).toHaveTextContent('false'));

    await fireEvent.press(screen.getByTestId('login'));

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid email or password'),
    );
    expect(screen.getByTestId('emailError')).toHaveTextContent('unknown account');
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    await expect(tokenStore.get()).resolves.toBeNull();
  });

  it('forgets the token on sign out', async () => {
    mockAuthApi.login.mockResolvedValue(SESSION);

    await renderAuth();
    await waitFor(() => expect(screen.getByTestId('initialising')).toHaveTextContent('false'));
    await fireEvent.press(screen.getByTestId('login'));
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));

    await fireEvent.press(screen.getByTestId('logout'));

    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('false'));
    await expect(tokenStore.get()).resolves.toBeNull();
  });
});
