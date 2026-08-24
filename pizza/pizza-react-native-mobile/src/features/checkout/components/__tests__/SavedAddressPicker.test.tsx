import { fireEvent, render, screen } from '@testing-library/react-native';
import { NEW_ADDRESS, SavedAddressPicker } from '../SavedAddressPicker';
import type { Address } from '@/types';

const HOME: Address = {
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

const WORK: Address = {
  ...HOME,
  id: 'a2',
  label: 'Work',
  line1: '400 Office Park',
  primary: false,
};

describe('SavedAddressPicker', () => {
  it('renders nothing at all for a guest with no saved addresses', async () => {
    const view = await render(
      <SavedAddressPicker addresses={[]} selectedId={NEW_ADDRESS} onSelect={jest.fn()} />,
    );

    expect(view.toJSON()).toBeNull();
  });

  it('lists each address with its full text, and flags the primary one', async () => {
    await render(
      <SavedAddressPicker addresses={[HOME, WORK]} selectedId="a1" onSelect={jest.fn()} />,
    );

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(screen.getByText('123 Main St, San Francisco, CA 94105')).toBeTruthy();
  });

  it('always offers "a different address" as one of the options', async () => {
    const onSelect = jest.fn();
    await render(<SavedAddressPicker addresses={[HOME]} selectedId="a1" onSelect={onSelect} />);

    await fireEvent.press(screen.getByTestId('address-new'));

    expect(onSelect).toHaveBeenCalledWith(NEW_ADDRESS);
  });

  it('keeps EXACTLY ONE option checked — including when the choice is "a different address"', async () => {
    const view = await render(
      <SavedAddressPicker addresses={[HOME, WORK]} selectedId="a2" onSelect={jest.fn()} />,
    );

    const checked = () =>
      ['address-a1', 'address-a2', 'address-new'].filter(
        (id) => screen.getByTestId(id).props.accessibilityState?.checked,
      );

    expect(checked()).toEqual(['address-a2']);

    await view.rerender(
      <SavedAddressPicker addresses={[HOME, WORK]} selectedId={NEW_ADDRESS} onSelect={jest.fn()} />,
    );

    expect(checked()).toEqual(['address-new']);
  });

  it('selects a saved address by id', async () => {
    const onSelect = jest.fn();
    await render(
      <SavedAddressPicker addresses={[HOME, WORK]} selectedId={NEW_ADDRESS} onSelect={onSelect} />,
    );

    await fireEvent.press(screen.getByTestId('address-a2'));

    expect(onSelect).toHaveBeenCalledWith('a2');
  });
});
