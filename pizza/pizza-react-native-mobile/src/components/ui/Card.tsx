import { StyleSheet, View, type ViewProps } from 'react-native';
import { theme } from '@/theme';

export interface CardProps extends ViewProps {
  /** Removes the internal padding, for a card whose child manages its own edges (e.g. an image). */
  flush?: boolean;
}

/**
 * A white surface with a soft shadow — the web app's `.card.border-0.shadow-sm`.
 *
 * <p>The shadow is deliberately in the theme rather than here, because iOS and Android express it
 * with completely different props and getting only one of them right is an easy thing to ship.
 */
export function Card({ flush = false, style, ...rest }: CardProps) {
  return <View style={[styles.card, !flush && styles.padded, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    /*
     * `overflow: hidden` clips a child image to the rounded corner — but it also CLIPS THE SHADOW
     * on Android. That is why it is not set here; a card that needs it wraps its image instead.
     */
    ...theme.shadow.card,
  },
  padded: { padding: theme.spacing.lg },
});
