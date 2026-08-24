import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { formatMoney } from '@/domain/money';
import { theme } from '@/theme';

/** One line of an order summary: a label on the left, money on the right. */
export function PriceRow({
  label,
  amount,
  emphasis = false,
  testID,
}: {
  label: string;
  amount: number;
  emphasis?: boolean;
  testID?: string;
}) {
  return (
    <View style={[styles.row, emphasis && styles.rowEmphasis]} testID={testID}>
      <Text variant={emphasis ? 'subheading' : 'caption'} tone={emphasis ? 'default' : 'muted'}>
        {label}
      </Text>
      <Text variant={emphasis ? 'subheading' : 'caption'} tone={emphasis ? 'default' : 'muted'}>
        {formatMoney(amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  rowEmphasis: { paddingTop: theme.spacing.sm },
});
