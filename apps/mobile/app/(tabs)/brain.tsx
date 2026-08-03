import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiService } from '../../src/services/api';
import { NotionNote, BRAIN_CATEGORIES, BrainCategory } from '../../src/types';

const CATEGORY_COLORS: Record<string, string> = {
  'Conversas Profundas': '#818cf8',
  'Planos': '#38bdf8',
  'Metas': '#4ade80',
  'Pontos Importantes': '#facc15',
  'Viradas de Chave': '#fb923c',
  'Memórias': '#f472b6',
  'Ideias Não Trabalhadas': '#c084fc',
};

export default function BrainScreen() {
  const [notes, setNotes] = useState<NotionNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NotionNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<BrainCategory>('Conversas Profundas');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [searchQuery, selectedCategoryFilter, notes]);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const data = await apiService.listNotes();
      setNotes(data);
    } catch (err) {
      console.warn('Erro ao listar notas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    triggerHaptic();
    setRefreshing(true);
    fetchNotes();
  };

  const filterNotes = () => {
    let result = [...notes];

    if (selectedCategoryFilter) {
      result = result.filter(
        (n) => n.category && n.category.toLowerCase().includes(selectedCategoryFilter.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.contentSnippet && n.contentSnippet.toLowerCase().includes(q))
      );
    }

    setFilteredNotes(result);
  };

  const handleSaveNote = async () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Campos obrigatórios', 'Por favor preencha o título e o conteúdo.');
      return;
    }

    setSaving(true);
    try {
      await apiService.saveNote({
        title: title.trim(),
        content: content.trim(),
        category,
      });

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      setTitle('');
      setContent('');
      setCategory('Conversas Profundas');
      setModalVisible(false);

      Alert.alert('Sucesso! 🚀', `Sua nota foi sincronizada no Notion sob a categoria "${category}".`);
      fetchNotes();
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err.message || 'Falha na comunicação com o Notion.');
    } finally {
      setSaving(false);
    }
  };

  const renderNoteCard = ({ item }: { item: NotionNote }) => {
    const badgeColor = CATEGORY_COLORS[item.category] || '#94a3b8';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Sem título'}</Text>
          <View style={[styles.badge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}40` }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{item.category || 'Geral'}</Text>
          </View>
        </View>

        {item.contentSnippet ? (
          <Text style={styles.cardSnippet} numberOfLines={3}>
            {item.contentSnippet}
          </Text>
        ) : (
          <Text style={styles.cardSnippetEmpty}>Toque para ver detalhes no Notion</Text>
        )}

        <View style={styles.cardFooter}>
          <Ionicons name="document-text-outline" size={12} color="#64748b" style={{ marginRight: 4 }} />
          <Text style={styles.cardDate}>
            Sincronizado {item.createdTime ? new Date(item.createdTime).toLocaleDateString() : 'hoje'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Banner / Metrics */}
      <View style={styles.metricsBanner}>
        <View style={styles.metricBox}>
          <Text style={styles.metricVal}>{notes.length}</Text>
          <Text style={styles.metricLbl}>Notas Registradas</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricBox}>
          <Text style={styles.metricVal}>7</Text>
          <Text style={styles.metricLbl}>Categorias Notion</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.liveDot} />
            <Text style={[styles.metricVal, { color: '#4ade80' }]}>Ativo</Text>
          </View>
          <Text style={styles.metricLbl}>Notion Sync</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar no 2º Cérebro..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.chip, !selectedCategoryFilter && styles.chipActive]}
            onPress={() => {
              triggerHaptic();
              setSelectedCategoryFilter(null);
            }}
          >
            <Text style={[styles.chipText, !selectedCategoryFilter && styles.chipTextActive]}>Todas</Text>
          </TouchableOpacity>

          {BRAIN_CATEGORIES.map((cat) => {
            const isActive = selectedCategoryFilter === cat;
            const color = CATEGORY_COLORS[cat] || '#818cf8';

            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  isActive && { backgroundColor: color, borderColor: color },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setSelectedCategoryFilter(isActive ? null : cat);
                }}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List / Empty / Loading */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Conectando ao Notion Database...</Text>
        </View>
      ) : filteredNotes.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Ionicons name="journal-outline" size={32} color="#818cf8" />
          </View>
          <Text style={styles.emptyTitle}>Nenhuma nota encontrada</Text>
          <Text style={styles.emptySub}>
            {searchQuery || selectedCategoryFilter
              ? 'Nenhuma nota corresponde aos filtros selecionados'
              : 'Clique no botão + abaixo para salvar uma nota no Notion'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          keyExtractor={(item) => item.id}
          renderItem={renderNoteCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
              colors={['#6366f1']}
            />
          }
        />
      )}

      {/* FAB (+) */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => {
          triggerHaptic();
          setModalVisible(true);
        }}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Form Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="journal" size={22} color="#6366f1" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Nova Nota no Notion</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>Título da Nota</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Ex: Aprendizados da reunião de alinhamento"
                placeholderTextColor="#64748b"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.fieldLabel}>Conteúdo / Detalhes</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                placeholder="Escreva os pontos principais ou código..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={5}
                value={content}
                onChangeText={setContent}
              />

              <Text style={styles.fieldLabel}>Selecione a Categoria Notion</Text>
              <View style={styles.pickerGrid}>
                {BRAIN_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerChip,
                      category === cat && styles.pickerChipActive,
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.pickerChipText,
                        category === cat && styles.pickerChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSaveNote}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar no Notion</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f17',
  },
  metricsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#141c2c',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#233047',
  },
  metricBox: {
    alignItems: 'center',
  },
  metricVal: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  metricLbl: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#233047',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
    marginRight: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141c2c',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#233047',
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
  },
  chipsWrapper: {
    height: 40,
    marginBottom: 8,
  },
  chipsScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#141c2c',
    borderWidth: 1,
    borderColor: '#233047',
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  chipText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#141c2c',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#233047',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardSnippet: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardSnippetEmpty: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 11,
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#818cf8',
    marginTop: 12,
    fontSize: 14,
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#141c2c',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#233047',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: '#0b0f17',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#233047',
    padding: 12,
    color: '#f8fafc',
    fontSize: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  pickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#0b0f17',
    borderWidth: 1,
    borderColor: '#233047',
    marginRight: 6,
    marginBottom: 6,
  },
  pickerChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  pickerChipText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  pickerChipTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
