import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, StyleSheet, TouchableOpacity, Text, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBackgroundView } from '@/src/components/AppBackgroundView';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { CardCategoryInfo, CardCategory, CardSubtype, PartyCard } from '@/src/models/CardModels';
import { CardsDeckRenderer } from '@/src/components/tools/CardsDeckRenderer';
import { useCustomCardsStore } from '@/src/store/useCustomCardsStore';

export default function CardsDeckScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [shuffleTrigger, setShuffleTrigger] = useState(0);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newCardText, setNewCardText] = useState('');
  const { addCustomCard } = useCustomCardsStore();
  
  const category = CardCategoryInfo[categoryId as keyof typeof CardCategoryInfo];

  if (!category) {
    return (
      <View style={styles.container}>
        <AppBackgroundView />
        <Text style={{ color: 'white', marginTop: 100, textAlign: 'center' }}>Category not found</Text>
      </View>
    );
  }

  const handleAddCard = () => {
    if (!newCardText.trim()) return;

    let subtype = CardSubtype.Personal;
    if (categoryId === CardCategory.Act) subtype = CardSubtype.Dare;
    else if (categoryId === CardCategory.Talk) subtype = CardSubtype.Discussion;
    else if (categoryId === CardCategory.Challenges) subtype = CardSubtype.Behavior;
    else if (categoryId === CardCategory.Penalty) subtype = CardSubtype.Penaltyfunny;
    else if (categoryId === CardCategory.Couple) subtype = CardSubtype.Playful;
    else if (categoryId === CardCategory.MostLikelyTo) subtype = CardSubtype.MLTFunny;

    const newCard: PartyCard = {
      id: `custom-${Date.now()}`,
      category: categoryId as CardCategory,
      subtype,
      text: newCardText.trim(),
      isSpicy: false,
    };

    addCustomCard(newCard);
    setNewCardText('');
    setIsAddModalVisible(false);
    
    // Automatically trigger shuffler to refresh deck and show the new card
    setShuffleTrigger(prev => prev + 1);
  };

  return (
    <View style={styles.container}>
      <AppBackgroundView />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 6,
          }} 
          onPress={() => setShuffleTrigger(prev => prev + 1)}
        >
          <IconSymbol name="shuffle" size={16} color={category.accentColor} />
          <Text style={{ color: category.accentColor, fontSize: 17, fontWeight: '500', marginLeft: 6 }}>Shuffle</Text>
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <View style={[styles.iconWrapper, { backgroundColor: category.accentColor + '20' }]}>
            <IconSymbol name={category.icon as any} size={14} color={category.accentColor} />
          </View>
          <Text style={styles.titleText}>{category.title}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {categoryId !== CardCategory.Favorites && (
            <TouchableOpacity 
              style={{
                paddingHorizontal: 6,
                paddingVertical: 6,
              }}
              onPress={() => setIsAddModalVisible(true)}
            >
              <IconSymbol name="plus" size={22} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={{
              paddingHorizontal: 8,
              paddingVertical: 6,
            }} 
            onPress={() => { if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }}
          >
            <IconSymbol name="xmark" size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
      </View>

      <CardsDeckRenderer categoryId={categoryId as any} shuffleTrigger={shuffleTrigger} />

      <Modal
        visible={isAddModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setIsAddModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Add Custom Card</Text>
              <Text style={styles.modalSubtitle}>Create your own custom prompt for {category.title}.</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Type your card prompt here..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline={true}
                value={newCardText}
                onChangeText={setNewCardText}
                maxLength={150}
                autoFocus={true}
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => {
                    setNewCardText('');
                    setIsAddModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitButton, { backgroundColor: category.accentColor }]} 
                  onPress={handleAddCard}
                >
                  <Text style={styles.submitButtonText}>Add Card</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontFamily: 'Viral-Black',
    fontSize: 20,
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(25,25,35,0.95)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: 'Viral-Black',
    fontSize: 20,
    color: 'white',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    color: 'white',
    padding: 16,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  cancelButtonText: {
    fontFamily: 'Viral-Black',
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  submitButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  submitButtonText: {
    fontFamily: 'Viral-Black',
    fontSize: 14,
    color: 'white',
    fontWeight: 'bold',
  },
});
