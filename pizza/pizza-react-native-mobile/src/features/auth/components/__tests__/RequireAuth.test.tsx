import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { RequireAuth } from '../RequireAuth';

const mockPush = jest.fn();
let mockAuthenticated = false;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../state/AuthProvider', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated }),
}));

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderGate = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RequireAuth>
        <Text>protected content</Text>
      </RequireAuth>
    </SafeAreaProvider>,
  );

describe('RequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated = false;
  });

  it('renders the children for a signed-in customer', async () => {
    mockAuthenticated = true;
    await renderGate();

    expect(screen.getByText('protected content')).toBeTruthy();
  });

  it('PROMPTS rather than redirecting, so the tapped tab stays selected', async () => {
    await renderGate();

    expect(screen.queryByText('protected content')).toBeNull();
    expect(screen.getByText('Sign in to see this')).toBeTruthy();
    // Nothing navigated on its own — the customer chooses.
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sends them to sign-in when they ask', async () => {
    await renderGate();

    await fireEvent.press(screen.getByText('Sign in'));

    expect(mockPush).toHaveBeenCalledWith('/login');
  });
});
