// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  // ─── Navigation ───
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.up': 'expand-less',
  'chevron.down': 'expand-more',
  'chevron.left.forwardslash.chevron.right': 'code',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'arrow.right': 'arrow-forward',
  'arrow.clockwise': 'refresh',
  'arrow.counterclockwise': 'replay',
  'arrow.uturn.backward': 'undo',
  'arrow.trianglehead.2.clockwise.rotate.90': 'sync',
  'arrow.triangle.2.circlepath': 'sync',

  // ─── Tab Bar & General ───
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'gamecontroller.fill': 'sports-esports',
  'gamecontroller': 'sports-esports',
  'wrench.and.screwdriver.fill': 'build',
  'person.2.fill': 'people',
  'wand.and.stars': 'auto-fix-high',
  'person.crop.circle': 'person',
  'person.crop.circle.badge.plus': 'person-add',

  // ─── Games ───
  'backward.fill': 'fast-rewind',
  'stopwatch.fill': 'timer',
  'theatermasks.fill': 'theater-comedy',
  'eye.fill': 'visibility',
  'eye.circle.fill': 'remove-red-eye',
  'eye.slash.fill': 'visibility-off',
  'square.grid.3x3.fill': 'grid-view',
  'map.fill': 'map',
  'paintpalette.fill': 'palette',
  'text.bubble.fill': 'chat-bubble',
  'pencil.and.scribble': 'edit',
  'face.smiling.fill': 'emoji-emotions',
  'brain.head.profile': 'psychology',
  'figure.run': 'directions-run',
  'suit.club.fill': 'eco',

  // ─── Media Controls ───
  'play.fill': 'play-arrow',
  'stop.fill': 'stop',
  'record.circle.fill': 'fiber-manual-record',
  'tortoise.fill': 'slow-motion-video',
  'square.and.arrow.up': 'share',
  'mic.fill': 'mic',

  // ─── Tools ───
  'die.face.5.fill': 'casino',
  'waterbottle.fill': 'local-drink',
  'hourglass': 'hourglass-empty',
  'circle.circle.fill': 'radio-button-checked',

  // ─── Symbols & Status ───
  'checkmark.circle.fill': 'check-circle',
  'questionmark.circle.fill': 'help',
  'exclamationmark.triangle.fill': 'warning',
  'crown.fill': 'workspace-premium',
  'star.fill': 'star',
  'sparkles': 'auto-awesome',
  'sparkle': 'auto-awesome',
  'sparkles.rectangle.stack.fill': 'auto-awesome-mosaic',
  'heart.fill': 'favorite',
  'flame.fill': 'local-fire-department',
  'bolt.fill': 'flash-on',
  'lock.fill': 'lock',
  'trophy.fill': 'emoji-events',
  'flag.fill': 'flag',
  'flag.checkered': 'flag',
  'bell.fill': 'notifications',
  'bell.badge.fill': 'notifications-active',

  // ─── People & Modes ───
  'person.3.fill': 'groups',
  'person.2.slash.fill': 'person-off',
  'person.3.sequence.fill': 'groups',
  'person.2.badge.gearshape.fill': 'group-work',
  'person.line.dotted.person.fill': 'groups',
  'iphone': 'smartphone',
  'iphone.gen3': 'smartphone',
  'iphone.radiowaves.left.and.right': 'phonelink-ring',
  'apps.iphone': 'devices',
  'smartphone': 'smartphone',
  'apps': 'apps',
  'groups': 'groups',
  'person.2.wave.2.fill': 'diversity-3',
  'diversity.3': 'diversity-3',

  // ─── Content ───
  'bookmark': 'bookmark-border',
  'bookmark.fill': 'bookmark',
  'bubble.left.and.bubble.right.fill': 'forum',
  'rectangle.on.rectangle.angled.fill': 'style',
  'rectangle.fill.on.rectangle.angled.fill': 'style',
  'text.alignleft': 'format-align-left',

  // ─── Math & Numbers ───
  'number.square.fill': 'pin',
  'number': 'tag',
  '123': 'pin',
  'minus': 'remove',
  'plus': 'add',
  'ellipsis': 'more-horiz',

  // ─── Hands & Gestures ───
  'hand.raised.fill': 'pan-tool',
  'hand.tap.fill': 'touch-app',
  'hand.thumbsup.fill': 'thumb-up',

  // ─── Documents ───
  'doc.on.doc': 'content-copy',
  'doc.on.doc.fill': 'content-copy',

  // ─── Nature ───
  'leaf.fill': 'eco',
  'moon.fill': 'dark-mode',
  'sun.max.fill': 'light-mode',
  'drop.fill': 'water-drop',
  'snowflake': 'ac-unit',
  'cloud.fill': 'cloud',
  'wind': 'air',
  'tornado': 'cyclone',
  'diamond.fill': 'diamond',
  'globe.americas.fill': 'public',

  // ─── Misc ───
  'shippingbox.fill': 'inventory-2',
  'timer': 'timer',
  'circle': 'radio-button-unchecked',
  'person.fill': 'person',
  'play.circle.fill': 'play-circle-filled',
  'tag.fill': 'sell',
  'infinity': 'all-inclusive',
  'person.fill.questionmark': 'help-outline',
  'waveform': 'graphic-eq',
  'waveform.path': 'graphic-eq',
  'slider.horizontal.3': 'tune',
  'gearshape.fill': 'settings',
  'gearshape': 'settings',
  'info.circle.fill': 'info',
  'questionmark.circle': 'help-outline',
} as unknown as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name] || 'help-outline';
  return <MaterialIcons color={color} size={size} name={mappedName} style={style} />;
}
