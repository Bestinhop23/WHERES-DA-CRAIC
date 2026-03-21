import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Colors } from '../constants/Colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type MenuItemProps = {
  item: {
    id: string;
    name: string;
    nameIrish: string;
    description: string;
    price: number;
    discountPrice: number;
    emoji: string;
    orderPhrase: string;
    pronunciation: string;
  };
};

export default function MenuItem({ item }: MenuItemProps) {
  const [expanded, setExpanded] = useState(false);
  const discount = Math.round((1 - item.discountPrice / item.price) * 100);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <TouchableOpacity onPress={toggle} activeOpacity={0.8}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.emoji}>{item.emoji}</Text>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.nameIrish}>{item.nameIrish}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
          <View style={styles.priceCol}>
            <Text style={styles.price}>€{item.price.toFixed(2)}</Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountPrice}>€{item.discountPrice.toFixed(2)}</Text>
            </View>
            <Text style={styles.discountLabel}>-{discount}% as Gaeilge</Text>
          </View>
        </View>

        {expanded && (
          <View style={styles.phraseSection}>
            <View style={styles.divider} />
            <Text style={styles.phraseLabel}>🗣️ Order as Gaeilge:</Text>
            <Text style={styles.phrase}>"{item.orderPhrase}"</Text>
            <Text style={styles.pronunciationLabel}>Pronunciation:</Text>
            <Text style={styles.pronunciation}>🔊 {item.pronunciation}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginRight: 14,
  },
  info: {
    flex: 1,
  },
  name: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  nameIrish: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 2,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  priceCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  price: {
    color: Colors.textMuted,
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  discountBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  discountPrice: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  discountLabel: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
  phraseSection: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  phraseLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  phrase: {
    color: Colors.accent,
    fontSize: 17,
    fontWeight: '700',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 24,
  },
  pronunciationLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 4,
  },
  pronunciation: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
});
