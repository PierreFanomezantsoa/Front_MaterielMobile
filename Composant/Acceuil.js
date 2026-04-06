import React, { useEffect, useState } from 'react';
import Toast from 'react-native-toast-message';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = 'http://192.168.43.58:3000/api/materiel';

const PRIMARY_COLOR = '#008080';
const BACKGROUND_LIGHT = '#F0F5F5';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR = '#333';

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 5000,
});

export default function MaterielScreen({ navigation }) {
  const [materiels, setMateriels] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [etatSelectorVisible, setEtatSelectorVisible] = useState(false);

  const [form, setForm] = useState({
    n_materiel: '',
    design: '',
    etat: 'bon',
    quantite: '',
  });

  const etatOptions = ['bon', 'mauvais', 'abimé'];

  useEffect(() => {
    fetchMateriels();
  }, []);

  const fetchMateriels = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('');
      setMateriels(res.data.data || []);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de récupérer les données.',
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.n_materiel.trim()) return showToastError('Numéro matériel requis');
    if (!form.design.trim()) return showToastError('Désignation requise');
    if (!form.quantite.trim() || isNaN(Number(form.quantite))) return showToastError('Quantité invalide');
    return true;
  };

  const showToastError = (msg) => {
    Toast.show({ type: 'error', text1: 'Validation', text2: msg });
    return false;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const payload = { ...form, quantite: Number(form.quantite) };
      let response;

      if (editingItem) {
        response = await axiosInstance.patch(`/${editingItem.id}`, payload);
      } else {
        response = await axiosInstance.post('', payload);
      }

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: response.data.message || 'Opération réussie',
      });

      setModalVisible(false);
      setEditingItem(null);
      setForm({ n_materiel: '', design: '', etat: 'bon', quantite: '' });
      fetchMateriels();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Erreur lors de la sauvegarde';
      Toast.show({ type: 'error', text1: 'Erreur', text2: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    Alert.alert('Confirmation', 'Supprimer ce matériel ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            const response = await axiosInstance.delete(`/${id}`);
            Toast.show({
              type: 'success',
              text1: 'Supprimé',
              text2: response.data.message || 'Supprimé avec succès',
            });
            fetchMateriels();
          } catch (error) {
            Toast.show({ type: 'error', text1: 'Erreur', text2: 'Erreur suppression' });
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setForm({
      n_materiel: item.n_materiel,
      design: item.design,
      etat: item.etat,
      quantite: item.quantite.toString(),
    });
    setModalVisible(true);
  };

  // --- Statistiques calculées ---
  const safeMateriels = Array.isArray(materiels) ? materiels : [];
  const totalQuantite = safeMateriels.reduce((sum, i) => sum + (Number(i.quantite) || 0), 0);
  const totalBon = safeMateriels.filter(i => i.etat?.toLowerCase() === 'bon').length;
  const totalMauvais = safeMateriels.filter(i => i.etat?.toLowerCase() === 'mauvais').length;
  const totalAbime = safeMateriels.filter(i => ['abimé', 'abime'].includes(i.etat?.toLowerCase())).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerDecoration} />
        <Text style={styles.headerTitle}>Gestion du Matériel</Text>
        <Text style={styles.headerSubtitle}>Inventaire & Suivi</Text>
      </View>

      {/* Bouton Ajouter */}
      <TouchableOpacity 
        style={[styles.addButton, (deleting || loading) && {opacity:0.5}]} 
        onPress={() => {
            setEditingItem(null);
            setForm({ n_materiel: '', design: '', etat: 'bon', quantite: '' });
            setModalVisible(true);
        }} 
        disabled={deleting || loading}
      >
        <Ionicons name="add-circle" size={24} color="white" style={{marginRight: 8}} />
        <Text style={styles.addText}>Ajouter un matériel</Text>
      </TouchableOpacity>

      {/* Liste ou Loading */}
      {loading && safeMateriels.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={safeMateriels}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{flex:1}}>
                  <Text style={styles.cardTitle}>{item.design}</Text>
                  <Text style={styles.cardSubtitle}>Ref: {item.n_materiel}</Text>
                </View>
                <View style={[styles.etatBadge, { backgroundColor: item.etat?.toLowerCase() === 'bon' ? '#4CAF50' : item.etat?.toLowerCase() === 'mauvais' ? '#F44336' : '#FF9800' }]}>
                  <Text style={styles.etatText}>{item.etat?.toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.cardDivider} />
              <View style={styles.cardFooter}>
                <View style={styles.quantityBox}>
                  <Text style={styles.quantityLabel}>Quantité</Text>
                  <Text style={styles.quantityValue}>{item.quantite}</Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                    <Ionicons name="create-outline" size={22} color="#1976D2" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={22} color="#D32F2F" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={80} color="#ccc" />
              <Text style={styles.emptyText}>Aucun matériel trouvé</Text>
            </View>
          }
        />
      )}

      {/* BARRE DE STATISTIQUES MISE À JOUR */}
      <View style={styles.bottomBar}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalQuantite}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, {color:'#4CAF50'}]}>{totalBon}</Text>
            <Text style={styles.statLabel}>Bon</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, {color:'#F44336'}]}>{totalMauvais}</Text>
            <Text style={styles.statLabel}>Mauvais</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, {color:'#FF9800'}]}>{totalAbime}</Text>
            <Text style={styles.statLabel}>Abîmé</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.statsNavigationButton} 
          onPress={() => navigation.navigate('statistiques', { data: safeMateriels })}
        >
          <Ionicons name="pie-chart" size={20} color="white" />
          <Text style={styles.statsNavText}>Voir Graphiques</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Formulaire */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingItem ? 'Modifier' : 'Ajouter'}</Text>
            <View style={{ width: 30 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.inputLabel}>Numéro matériel</Text>
            <TextInput style={styles.input} value={form.n_materiel} onChangeText={(t) => setForm({ ...form, n_materiel: t })} placeholder="Ex: MAT-001" />
            <Text style={styles.inputLabel}>Désignation</Text>
            <TextInput style={styles.input} value={form.design} onChangeText={(t) => setForm({ ...form, design: t })} placeholder="Nom du matériel" />
            <Text style={styles.inputLabel}>État</Text>
            <TouchableOpacity style={styles.input} onPress={() => setEtatSelectorVisible(true)}>
              <Text style={{ color: TEXT_COLOR }}>{form.etat.toUpperCase()}</Text>
            </TouchableOpacity>
            <Text style={styles.inputLabel}>Quantité</Text>
            <TextInput style={styles.input} value={form.quantite} onChangeText={(t) => setForm({ ...form, quantite: t })} keyboardType="numeric" placeholder="0" />
            <TouchableOpacity style={[styles.saveButton, loading && {opacity:0.7}]} onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>ENREGISTRER</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Sélecteur d'état */}
      <Modal transparent visible={etatSelectorVisible} animationType="fade">
        <TouchableOpacity style={styles.etatModalOverlay} onPress={() => setEtatSelectorVisible(false)}>
          <View style={styles.etatModal}>
            {etatOptions.map(opt => (
              <TouchableOpacity key={opt} style={styles.etatOption} onPress={() => { setForm({ ...form, etat: opt }); setEtatSelectorVisible(false); }}>
                <Text style={styles.etatOptionText}>{opt.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_LIGHT },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: PRIMARY_COLOR, paddingTop: 50, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 5 },
  headerDecoration: { position: 'absolute', top: -50, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  addButton: { backgroundColor: PRIMARY_COLOR, margin: 16, padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  addText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 180 },
  card: { backgroundColor: CARD_BG, borderRadius: 15, padding: 16, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: PRIMARY_COLOR },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR },
  cardSubtitle: { fontSize: 13, color: '#777', marginTop: 2 },
  etatBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  etatText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  cardDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quantityBox: { backgroundColor: '#f9f9f9', padding: 8, borderRadius: 8, alignItems: 'center', minWidth: 70 },
  quantityLabel: { fontSize: 10, color: '#999' },
  quantityValue: { fontSize: 16, fontWeight: 'bold', color: PRIMARY_COLOR },
  actionButtons: { flexDirection: 'row', gap: 15 },
  bottomBar: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'white', padding: 15, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: TEXT_COLOR },
  statLabel: { fontSize: 11, color: '#999', marginTop: 2 },
  statDivider: { width: 1, height: '80%', backgroundColor: '#eee', alignSelf: 'center' },
  statsNavigationButton: { backgroundColor: PRIMARY_COLOR, padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  statsNavText: { color: 'white', fontWeight: 'bold', marginLeft: 8 },
  modalContainer: { flex: 1, backgroundColor: BACKGROUND_LIGHT },
  modalHeader: { backgroundColor: PRIMARY_COLOR, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: TEXT_COLOR },
  input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 10, marginBottom: 20, fontSize: 16, justifyContent: 'center' },
  saveButton: { backgroundColor: PRIMARY_COLOR, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  etatModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  etatModal: { backgroundColor: 'white', width: '80%', borderRadius: 15, padding: 10 },
  etatOption: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  etatOptionText: { textAlign: 'center', fontWeight: 'bold', color: TEXT_COLOR },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#999', fontSize: 16, marginTop: 10 },
});