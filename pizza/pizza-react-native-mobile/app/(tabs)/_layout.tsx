import { useState } from 'react';
import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { CartHeaderButton } from '@/features/cart/components/CartHeaderButton';
import { CartSheet } from '@/features/cart/components/CartSheet';
import { theme } from '@/theme';

/**
 * The four customer tabs.
 *
 * <p>A tab bar rather than the web app's navbar, because that is what a phone expects: the
 * destinations are always visible and always within thumb reach, instead of behind a hamburger.
 *
 * <p>The cart is deliberately NOT a tab. It is a header button that opens a sheet, so the customer
 * never loses the screen they were on — tapping a fifth tab to check the cart and then having to
 * navigate back to the menu is the friction this avoids. It also mirrors the web app, where the
 * cart is an offcanvas drawer over the page rather than a route.
 */
export default function TabsLayout() {
  /*
   * The sheet's open state lives HERE, not in the cart context.
   *
   * The cart CONTENTS are shared state — the badge, the menu and checkout all read them. Whether a
   * sheet happens to be open is purely visual, needed by exactly two components, and putting it in
   * context would re-render every consumer each time it toggles. "Only shared state goes in the
   * store" applies to context too.
   */
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surfaceInverse },
          headerTintColor: theme.colors.onSurfaceInverse,
          headerTitleStyle: { fontWeight: theme.fontWeight.bold },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.borderSubtle,
          },
          sceneStyle: { backgroundColor: theme.colors.background },
          // One header button for every tab, so the cart is reachable from anywhere.
          headerRight: () => <CartHeaderButton onPress={() => setCartOpen(true)} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'StayHub Pizza',
            tabBarLabel: 'Home',
            tabBarIcon: ({ color }) => <TabIcon glyph="🏠" color={color} />,
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: 'Menu',
            tabBarIcon: ({ color }) => <TabIcon glyph="🍕" color={color} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'Orders',
            tabBarIcon: ({ color }) => <TabIcon glyph="🧾" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <TabIcon glyph="👤" color={color} />,
          }}
        />
      </Tabs>

      {/*
        The sheet is a SIBLING of the navigator, not a child of a screen. Rendered inside a tab it
        would unmount the moment the customer switched tabs while it was open.
      */}
      <CartSheet visible={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

/**
 * Emoji tab icons.
 *
 * <p>A real app would use `@expo/vector-icons` here. Emoji keep the example dependency-free and
 * make the point that a tab icon is just a component — but they do NOT take a tint, which is why
 * `color` is applied as opacity instead: the active tab reads as brighter rather than as red.
 */
function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return (
    <Text style={{ fontSize: 22, opacity: color === theme.colors.primary ? 1 : 0.45 }}>
      {glyph}
    </Text>
  );
}
