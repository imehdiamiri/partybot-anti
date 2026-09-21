import React, { Children } from 'react';
import { View } from 'react-native';

/** Explicit rows keep native pixel rounding from wrapping the last column. */
export function GameGrid({ columns, width, gap = 6, children }: {
  columns: number; width: number; gap?: number; children: React.ReactNode;
}) {
  const cells = Children.toArray(children);
  return <View style={{ width, gap, alignSelf: 'center' }}>
    {Array.from({ length: Math.ceil(cells.length / columns) }, (_, row) => (
      <View key={row} style={{ flexDirection: 'row', gap, justifyContent: 'center' }}>
        {cells.slice(row * columns, (row + 1) * columns)}
      </View>
    ))}
  </View>;
}
