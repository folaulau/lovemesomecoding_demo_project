import { fireEvent, render, screen } from '@testing-library/react-native';
import { QuantityStepper } from '../QuantityStepper';

describe('QuantityStepper', () => {
  it('shows the current quantity', async () => {
    await render(<QuantityStepper quantity={3} onChange={jest.fn()} itemName="Pepperoni" />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('reports one more and one less', async () => {
    const onChange = jest.fn();
    await render(<QuantityStepper quantity={2} onChange={onChange} itemName="Pepperoni" />);

    await fireEvent.press(screen.getByLabelText('Increase quantity of Pepperoni'));
    expect(onChange).toHaveBeenLastCalledWith(3);

    await fireEvent.press(screen.getByLabelText('Decrease quantity of Pepperoni'));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('will not go below the minimum', async () => {
    const onChange = jest.fn();
    await render(<QuantityStepper quantity={1} onChange={onChange} itemName="Pepperoni" min={1} />);

    await fireEvent.press(screen.getByLabelText('Decrease quantity of Pepperoni'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('will not go above the maximum', async () => {
    const onChange = jest.fn();
    await render(<QuantityStepper quantity={10} onChange={onChange} itemName="Pepperoni" max={10} />);

    await fireEvent.press(screen.getByLabelText('Increase quantity of Pepperoni'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('names the item in its labels, so two steppers are distinguishable', async () => {
    await render(<QuantityStepper quantity={1} onChange={jest.fn()} itemName="Diet Coke" />);
    expect(screen.getByLabelText('Increase quantity of Diet Coke')).toBeTruthy();
  });
});
