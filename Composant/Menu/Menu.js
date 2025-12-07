import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Image,
  TouchableOpacity, Modal, Dimensions, Alert, Share, Platform, StatusBar, TextInput,
  FlatList, KeyboardAvoidingView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get("window");

// Constantes de style
const PRIMARY_COLOR = '#008080'; // Teal
const ACCENT_COLOR = '#4CAF50'; // Vert pour les prix
const BACKGROUND_COLOR = '#F4F7F9'; // Gris clair
const CARD_COLOR = '#FFFFFF';
const ERROR_COLOR = '#FF6347'; // Tomato pour les erreurs

// --- CONFIGURATION CLÉ AMÉLIORÉE ---
const BACKEND_API_URL = "http://192.168.137.118:3000";
// ------------------------------------

// Utilitaires - Rendu plus générique
const getItemPrice = (item) => item.price || item.prix || 0;
const getItemName = (item) => item.name || item.nom || 'Article inconnu';
const getItemCategory = (item) => item.category || item.categorie || 'Autres';


// =========================================================================
// UTILITAIRE D'AFFICHAGE MONÉTAIRE
// =========================================================================
/**
 * Formatte un montant monétaire.
 * @param {number | string} amount Le montant à formater.
 * @returns {string} Le montant formaté.
 */
const formatMoney = (amount) => {
  const num = parseFloat(amount);
  if (isNaN(num)) return "0";

  const fixed = num.toFixed(2);
  const parts = fixed.split('.');

  // Remplace les décimales par une chaîne vide si elles sont "00"
  const decimalPart = parts[1] === '00' ? '' : `.${parts[1]}`;

  // Ajoute le séparateur de milliers (espace) et concatène
  return parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ") + decimalPart;
};


// =========================================================================
// Composant d'Image avec gestion des erreurs
// =========================================================================
const MenuItemImage = React.memo(({ uri, style }) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [uri]);

  if (imageError || !uri) {
    return (
      <View style={styles.imageFallbackGrid}>
        <Text style={{ color: CARD_COLOR, fontWeight: 'bold', textAlign: 'center' }}>[Image manquante]</Text>
        <Text style={{ color: CARD_COLOR, fontSize: 10, marginTop: 4 }}>Erreur de chargement</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={(e) => {
        console.log(`Erreur chargement image: ${e.nativeEvent.error} (URL: ${uri})`);
        setImageError(true);
      }}
      accessibilityLabel="Image du produit"
      resizeMode="cover"
    />
  );
});

// =========================================================================
// Composant de Carte de Menu optimisé
// =========================================================================
const MenuItemCard = React.memo(({ item, storedTable, addToCart }) => (
  <View key={item.id} style={styles.cardGrid}>
    <MenuItemImage uri={item.image} style={styles.imageGrid} />
    <View style={styles.textBoxGrid}>
      <Text style={styles.nameGrid} numberOfLines={1} accessibilityRole="header">{getItemName(item)}</Text>
      <Text style={styles.descGrid} numberOfLines={2}>{item.description || "Pas de description."}</Text>
      {storedTable && <Text style={styles.tableNumberGrid}></Text>}

      <View style={styles.priceOrderContainerGrid1}>
        <Text style={styles.priceGrid} accessibilityLabel={`Prix: ${formatMoney(getItemPrice(item))} Ar`}>
          {formatMoney(getItemPrice(item))} Ar
        </Text>
      </View>
      <View style={styles.priceOrderContainerGrid}>
        <TouchableOpacity
          style={styles.orderBtnGrid}
          onPress={() => addToCart(item)}
          accessibilityLabel={`Ajouter ${getItemName(item)} au panier`}
          accessibilityRole="button"
        >
          <FontAwesome name="cart-plus" size={16} color={CARD_COLOR} />
          <Text style={styles.orderBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
));

// =========================================================================
// NOUVEAU COMPOSANT : CartItemComponent (Pour le modal Panier)
// =========================================================================
const CartItemComponent = React.memo(({ cartItem, updateQuantity, formatMoney, getItemName, getItemPrice }) => {
  const item = cartItem.item;
  const subTotal = getItemPrice(item) * cartItem.qty;

  return (
    <View style={styles.cartItem}>
      {/* Colonne 1: Infos */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{getItemName(item)}</Text>
        <Text style={styles.itemUnitText}>{formatMoney(getItemPrice(item))} Ar / unité</Text>
      </View>

      {/* Colonne 2: Contrôles de Quantité */}
      <View style={styles.itemControls}>
        <TouchableOpacity onPress={() => updateQuantity(item.id, -1)} style={styles.qtyButton} accessibilityLabel="Diminuer la quantité">
          <Ionicons name="remove-circle" size={24} color={ERROR_COLOR} />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{cartItem.qty}</Text>
        <TouchableOpacity onPress={() => updateQuantity(item.id, 1)} style={styles.qtyButton} accessibilityLabel="Augmenter la quantité">
          <Ionicons name="add-circle" size={24} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Colonne 3: Sous-total */}
      <Text style={styles.itemSubTotal}>{formatMoney(subTotal)} Ar</Text>
    </View>
  );
});

// =========================================================================
// Composant principal
// =========================================================================

export default function KiosqueMenu({ route, navigation }) {
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState(['Tout']);
  const [selectedCategory, setSelectedCategory] = useState('Tout');
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [storedTable, setStoredTable] = useState(null);

  // --- 1. Gestion de la Table et du Menu ---

  useEffect(() => {
    const setup = async () => {
      try {
        const saved = await AsyncStorage.getItem("TABLE_ID");
        if (saved) setStoredTable(saved);

        if (route.params?.tableNumber) {
          const t = route.params.tableNumber.toString();
          await AsyncStorage.setItem("TABLE_ID", t);
          setStoredTable(t);
        }
      } catch (e) {
        console.error("Erreur de gestion de la table:", e);
        Alert.alert("Erreur Stockage", "Impossible de gérer le numéro de table.");
      }
    };
    setup();
  }, [route.params?.tableNumber]);

  // Charger le menu
  const loadMenu = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_API_URL}/menus`);
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status}`);

      const data = await res.json();
      const items = Array.isArray(data) ? data : Array.isArray(data.menus) ? data.menus : [];

      setMenu(items);
      const uniqueCategories = ['Tout', ...new Set(items.map(item => getItemCategory(item)))];
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Erreur fetch:', err);
      Alert.alert("Erreur Réseau", `Impossible de charger le menu. Vérifiez l'adresse IP: ${BACKEND_API_URL}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMenu(); }, []);

  // --- 2. Fonctions Panier ---

  const notify = (message) => {
    setNotifications(prev => [
      { id: Date.now(), message, date: new Date().toLocaleTimeString() },
      ...prev.slice(0, 4), // Garder les 5 dernières notifs
    ]);
  };

  const addToCart = (item) => {
    setCart(prevCart => {
      const existing = prevCart.find(c => c.item.id === item.id);
      if (existing) {
        notify(`Quantité de ${getItemName(item)} augmentée.`);
        return prevCart.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      }
      else {
        notify(`Ajouté : ${getItemName(item)}.`);
        return [...prevCart, { item, qty: 1 }];
      }
    });
  };

  const updateCartItemQuantity = (itemId, change) => {
    setCart(prevCart => {
      const newCart = prevCart.map(c =>
        c.item.id === itemId ? { ...c, qty: c.qty + change } : c
      ).filter(c => c.qty > 0);

      const item = prevCart.find(c => c.item.id === itemId)?.item;
      if (item) {
        notify(change > 0 ? `+1 ${getItemName(item)}` : `-1 ${getItemName(item)}`);
      }
      return newCart;
    });
  };

  // Calcul du prix total optimisé avec useMemo
  const totalPrice = useMemo(() =>
    cart.reduce((sum, c) => sum + getItemPrice(c.item) * c.qty, 0)
    , [cart]);

  // --- 3. Fonctions Paiement ---

  const buildItemsPayload = (cartItems) => {
    const itemsArray = cartItems.map(c => ({
      name: getItemName(c.item),
      price: getItemPrice(c.item),
      qty: c.qty,
      id: c.item.id ?? null,
    }));
    const itemsJson = JSON.stringify(itemsArray);
    return { itemsArray, itemsJson };
  };

  const handlePayment = async (method) => {
    if (cart.length === 0) return Alert.alert("Panier vide !", "Veuillez ajouter des articles avant de payer.");
    if (!storedTable) return Alert.alert("Erreur", "Le numéro de table n'est pas défini.");

    setProcessingPayment(true);
    const localTxnId = Date.now().toString().slice(-6);
    const totalAmount = totalPrice;

    const optimisticReceipt = { id: localTxnId, date: new Date().toLocaleString(), method, amount: totalAmount, items: cart };
    setReceipt(optimisticReceipt);

    const { itemsJson } = buildItemsPayload(cart);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const totalAmountForApi = totalAmount.toFixed(2);

      const body = {
        table_number: storedTable,
        order_name: `CMD-${localTxnId}`,
        total_amount: totalAmountForApi,
        payment_method: method,
        status: 'Payée',
        items: itemsJson,
      };

      const response = await fetch(`${BACKEND_API_URL}/commande`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      clearTimeout(timeout);

      const text = await response.text();
      let result;
      try { result = text ? JSON.parse(text) : {}; } catch (e) { result = { message: text }; }

      if (!response.ok) {
        const serverMsg = result?.error || result?.message || `Erreur serveur (${response.status})`;
        Alert.alert("Erreur Commande", serverMsg);
        notify(`Erreur commande: ${serverMsg}`);
      } else {
        const backendId = (result && (result.commande_id || result.id || result.commande?.id)) || null;
        setReceipt({ ...optimisticReceipt, id: backendId || optimisticReceipt.id });
        notify(`Commande enregistrée (ID: ${backendId || 'local'}).`);
        Alert.alert("Succès 🎉", `Commande envoyée pour ${formatMoney(totalAmount)} Ar !`);
        setCart([]);
      }
    } catch (err) {
      const errorMsg = err.name === 'AbortError' ? "La requête a expiré (Timeout)." : "Une erreur est survenue lors de l'envoi.";
      Alert.alert("Erreur Réseau", errorMsg);
      notify(`Échec envoi commande: ${errorMsg}`);
    } finally {
      setProcessingPayment(false);
    }
  };

  const shareReceipt = async () => {
    if (!receipt) return;
    const itemsList = receipt.items.map(c =>
      `- ${getItemName(c.item)} x${c.qty} (${formatMoney(getItemPrice(c.item) * c.qty)} Ar)`
    ).join("\n");

    const text = `🧾 Reçu: ${receipt.id}\nDate: ${receipt.date}\nMéthode: ${receipt.method}\nMontant Total: ${formatMoney(receipt.amount)} Ar\n\nArticles:\n${itemsList}`;

    try {
      await Share.share({ message: text });
    } catch (err) {
      console.error("Erreur de partage :", err);
      Alert.alert("Erreur", "Impossible de partager le reçu.");
    }
  };

  // --- 4. Filtre et Rendu ---

  // Filtrage combiné optimisé avec useMemo
  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchCategory = selectedCategory === 'Tout' || getItemCategory(item) === selectedCategory;
      const matchName = getItemName(item).toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchName;
    });
  }, [menu, selectedCategory, searchQuery]);

  // Fonction de rendu du FlatList
  const renderMenuItem = ({ item }) => (
    <MenuItemCard
      item={item}
      storedTable={storedTable}
      addToCart={addToCart}
    />
  );

  // --- 5. Composants Modals ---

  const RenderNotificationModal = () => (
    <Modal visible={showNotif} transparent animationType="fade" onRequestClose={() => setShowNotif(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>
            <Ionicons name="notifications" size={24} color={PRIMARY_COLOR} /> Notifications
          </Text>
          <ScrollView style={styles.modalScrollView}>
            {notifications.length === 0 ? (
              <Text style={{ textAlign: 'center', color: 'gray', padding: 10 }}>Aucune notification</Text>
            ) : (
              notifications.map((n) => (
                <View key={n.id} style={styles.notifItem}>
                  <Text style={{ fontWeight: '600', color: '#333' }}>{n.message}</Text>
                  <Text style={{ fontSize: 12, color: 'gray' }}>{n.date}</Text>
                </View>
              ))
            )}
          </ScrollView>
          <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: ERROR_COLOR }]} onPress={() => setNotifications([])}>
            <Text style={styles.modalActionText}>
              <Ionicons name="trash-bin" size={16} color="white" /> Vider
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowNotif(false)}>
            <Text style={styles.modalCloseText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // =========================================================================
  // REFONTE DU MODAL PANIER
  // =========================================================================
  const RenderCartModal = () => (
    <Modal 
      visible={showCart} 
      transparent 
      animationType="slide" 
      onRequestClose={() => setShowCart(false)}
      statusBarTranslucent
    >
      <KeyboardAvoidingView 
        style={styles.modalContainerFixed}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalView}>
          
          {/* EN-TÊTE DU MODAL */}
          <View style={styles.modalHeader}>
              <Ionicons name="cart" size={30} color={PRIMARY_COLOR} />
              <Text style={styles.modalTitleModal}>Votre Panier ({cart.length})</Text>
              <TouchableOpacity onPress={() => setShowCart(false)} style={styles.closeButton} accessibilityLabel="Fermer le panier">
                  <Ionicons name="close-circle" size={30} color="#999" />
              </TouchableOpacity>
          </View>
          
          <View style={styles.divider} />
          
          {/* LISTE DES ARTICLES */}
          {cart.length === 0 ? (
            <View style={styles.emptyCartView}>
              <Ionicons name="cart-outline" size={50} color="gray" />
              <Text style={styles.emptyCartText}>Votre panier est vide.</Text>
            </View>
          ) : (
            <ScrollView style={styles.cartListScroll} showsVerticalScrollIndicator={false}>
              {cart.map((cartItem) => (
                <CartItemComponent
                  key={cartItem.item.id}
                  cartItem={cartItem}
                  updateQuantity={updateCartItemQuantity}
                  formatMoney={formatMoney}
                  getItemName={getItemName}
                  getItemPrice={getItemPrice}
                />
              ))}
            </ScrollView>
          )}

          {/* RÉCAPITULATIF ET PAIEMENT */}
          <View style={styles.footerContainer}>
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total à Commander :</Text>
              <Text style={styles.totalAmount}>{formatMoney(totalPrice)} Ar</Text>
            </View>

            {/* Bouton Principal de Commande */}
            <TouchableOpacity
              style={[styles.payBtn, processingPayment || cart.length === 0 ? styles.payBtnDisabled : null]}
              disabled={cart.length === 0 || processingPayment}
              onPress={() => handlePayment("Mobile Money")}
              accessibilityRole="button"
            >
              <Text style={styles.payText}>
                {processingPayment ? "⏳ Traitement en cours..." : "✅ Valider la Commande"}
              </Text>
            </TouchableOpacity>

            {/* Bouton secondaire: Autres options (si panier non vide) */}
            {cart.length > 0 && !processingPayment && (
              <TouchableOpacity
                style={styles.alternatePayBtn}
                onPress={() => Alert.alert(
                  "Méthode de Paiement", 
                  "Sélectionnez comment le client paiera.",
                  [
                    { text: "Carte bancaire", onPress: () => handlePayment("Carte bancaire") },
                    { text: "Espèces", onPress: () => handlePayment("Espèces") },
                    { text: "Annuler", style: "cancel" }
                  ]
                )}
                accessibilityRole="button"
                accessibilityLabel="Choisir une autre méthode de paiement"
              >
                <Text style={styles.alternatePayText}>Paiement par Carte / Espèces</Text>
              </TouchableOpacity>
            )}

            {/* Section Reçu (si commande passée) */}
            {receipt && (
              <View style={styles.receiptBox}>
                <Text style={styles.receiptTitle}>🧾 Commande Envoyée (Référence: {receipt.id})</Text>
                <Text style={{fontSize: 12}}>
                  Nombre commande: {receipt.items.length +"\n"} 
                  Montant: {   formatMoney(receipt.amount)} Ar </Text>
                <TouchableOpacity style={styles.shareButton} onPress={shareReceipt}>
                  <Text style={styles.shareButtonText}>
                    <Ionicons name="share" size={16} color="white" /> Partager Reçu
                  </Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
  // =========================================================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerText} numberOfLines={1}>Kiosque Menu </Text>
        <View style={styles.topRight}>

          <TouchableOpacity style={styles.topIcon} onPress={() => setShowCart(true)} accessibilityLabel={`Ouvrir le panier, ${cart.length} articles`}>
            <FontAwesome name="shopping-cart" size={22} color={CARD_COLOR} />
            {cart.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{cart.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.topIcon} onPress={() => setShowNotif(true)} accessibilityLabel="Notifications">
            <FontAwesome name="bell" size={22} color={CARD_COLOR} />
            {notifications.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{Math.min(notifications.length, 9)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {/* CATEGORIES */}
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10 }}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryButton, selectedCategory === cat && styles.categorySelected]}
                onPress={() => setSelectedCategory(cat)}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: selectedCategory === cat }}
              >
                <Text style={[styles.categoryText, selectedCategory === cat && styles.categoryTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* FILTRE PAR NOM (Design Amélioré) */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            placeholder="Rechercher plats ou boissons..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInputAmeliore}
            clearButtonMode="while-editing"
            accessibilityLabel="Champ de recherche du menu"
          />
        </View>

        {/* LISTE VERTICALE OPTIMISÉE (FlatList) */}
        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY_COLOR} style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={filteredMenu}
            renderItem={renderMenuItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            numColumns={2}
            initialNumToRender={10}
            windowSize={21}
            ListEmptyComponent={() => (
              <View style={styles.emptyListMessage}>
                <Ionicons name="sad-outline" size={40} color="gray" />
                <Text style={{ fontSize: 18, color: 'gray', marginTop: 10 }}>Aucun plat trouvé.</Text>
                <TouchableOpacity onPress={loadMenu} style={{ marginTop: 15, padding: 10, backgroundColor: PRIMARY_COLOR, borderRadius: 8 }}>
                  <Text style={{ color: CARD_COLOR, fontWeight: 'bold' }}>Actualiser le Menu</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      <RenderNotificationModal />
      <RenderCartModal />

     {/* BARRE DE NAVIGATION INFÉRIEURE */}
                 <View style={styles.bottomBar}>
                     <TouchableOpacity
                         style={styles.bottomBtn}
                         onPress={() => navigation.navigate("accueil")}
                     >
                         <FontAwesome name="home" size={24} color={PRIMARY_COLOR} />
                         <Text style={styles.bottomText}>Accueil</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                         style={styles.bottomBtn}
                         onPress={() => navigation.navigate("menuList")}
                     >
                        <View style={styles.activeIndicator}>
                             <FontAwesome name="list" size={24} color="#fff" />
                         </View>
                         <Text style={[styles.bottomText,  styles.activeText]}>Menus</Text>
                     </TouchableOpacity>
                     <TouchableOpacity
                         style={styles.bottomBtn}
                         onPress={() => navigation.navigate("Publications")}
                     >
                             <FontAwesome name="bullhorn" size={24} color={PRIMARY_COLOR} />
                         <Text style={[styles.bottomText]}>Publi.</Text>
                     </TouchableOpacity>
          </View>
    </View>
  );
}

// =========================================================================
// STYLES MIS À JOUR (Incluant les nouveaux styles de Modal Panier)
// =========================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: PRIMARY_COLOR, padding: 15, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50 },
  headerText: { fontSize: 18, fontWeight: 'bold', color: CARD_COLOR, flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center' },
  topIcon: { marginLeft: 15 },
  badge: { position: 'absolute', top: -5, right: -10, backgroundColor: ERROR_COLOR, borderRadius: 8, paddingHorizontal: 5 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  categoryContainer: { height: 50, marginTop: 5 },
  categoryButton: { marginRight: 10, borderRadius: 15, borderWidth: 1, borderColor: PRIMARY_COLOR, paddingHorizontal: 15, paddingVertical: 8 },
  categorySelected: { backgroundColor: PRIMARY_COLOR },
  categoryText: { color: PRIMARY_COLOR, fontWeight: '500' },
  categoryTextSelected: { color: CARD_COLOR },

  // --- STYLES DE RECHERCHE ---
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_COLOR,
    borderRadius: 30,
    marginHorizontal: 15,
    marginVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    paddingRight: 8,
  },
  searchInputAmeliore: {
    flex: 1,
    height: 45,
    fontSize: 16,
    color: '#333',
    paddingVertical: 5,
    paddingLeft: 0,
  },
  // ------------------------------------

  listContainer: { paddingHorizontal: 10, paddingBottom: 80, paddingTop: 5 },

  cardGrid: {
    width: screenWidth / 2 - 15,
    marginHorizontal: 5,
    marginBottom: 15,
    backgroundColor: CARD_COLOR,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageGrid: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15
  },
  imageFallbackGrid: {
    width: '100%',
    height: 120,
    backgroundColor: ERROR_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15
  },
  textBoxGrid: { flex: 1, padding: 8, justifyContent: 'space-between' },

  nameGrid: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  descGrid: { fontSize: 10, color: '#666', marginVertical: 2, height: 30 },
  tableNumberGrid: { fontSize: 9, color: 'gray' },

  priceOrderContainerGrid1: { justifyContent: 'flex-start', alignItems: 'flex-start', marginTop: 5 },
  priceGrid: { fontSize: 14, fontWeight: '700', color: PRIMARY_COLOR },

  priceOrderContainerGrid: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 5 },
  orderBtnGrid: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: "center",
  },
  orderBtnText: {
    color: CARD_COLOR,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 5
  },
  emptyListMessage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 50 },

  // --- Styles Modal Notification (Existants) ---
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalBox: {
    backgroundColor: CARD_COLOR,
    margin: 20,
    borderRadius: 15,
    padding: 15,
    maxHeight: '80%',
    marginHorizontal: 10,
    marginBottom: Platform.OS === 'ios' ? 0 : 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  modalScrollView: { marginBottom: 10, maxHeight: 300 },
  notifItem: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  modalActionBtn: { padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  modalActionText: { color: 'white', fontWeight: 'bold' },
  modalCloseBtn: { padding: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#ccc' },
  modalCloseText: { fontWeight: 'bold' },

  // --- NOUVEAUX Styles Modal Panier ---

  modalContainerFixed: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalView: {
    backgroundColor: CARD_COLOR,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 5 },
      android: { elevation: 15 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitleModal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
    flex: 1,
    marginLeft: 10,
  },
  closeButton: {
    padding: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 15,
  },
  cartListScroll: {
    maxHeight: Dimensions.get('window').height * 0.45,
    marginBottom: 15,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F7F9',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 2,
    paddingRight: 5,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  itemUnitText: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 80,
  },
  qtyButton: {
    padding: 5,
  },
  quantityText: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  itemSubTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT_COLOR,
    textAlign: 'right',
    minWidth: 70,
  },
  emptyCartView: {
    alignItems: 'center',
    padding: 30,
  },
  emptyCartText: {
    fontSize: 16,
    color: 'gray',
    marginTop: 10,
  },
  footerContainer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },

  payBtn: { backgroundColor: PRIMARY_COLOR, padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  payBtnDisabled: { backgroundColor: '#B0C4DE' },
  payText: { color: CARD_COLOR, fontWeight: 'bold', fontSize: 16 },

  alternatePayBtn: {
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: BACKGROUND_COLOR,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
  },
  alternatePayText: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
    fontSize: 14,
  },

  receiptBox: { padding: 12, backgroundColor: '#f0fff0', borderRadius: 10, marginVertical: 10, borderWidth: 1, borderColor: ACCENT_COLOR },
  receiptTitle: { fontWeight: 'bold', marginBottom: 5, color: ACCENT_COLOR, fontSize: 14 },
  shareButton: { marginTop: 8, backgroundColor: ACCENT_COLOR, padding: 8, borderRadius: 8, alignItems: 'center' },
  shareButtonText: { color: CARD_COLOR, fontWeight: '600', fontSize: 14 },

  bottomBar: { height: 70, flexDirection: "row", backgroundColor: CARD_COLOR, justifyContent: "space-around", alignItems: "center", paddingBottom: Platform.OS === "ios" ? 20 : 0, position: "absolute", bottom: 0, left: 0, right: 0, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  bottomBtn: { justifyContent: "center", alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, flex: 1 },
  activeIndicator: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: PRIMARY_COLOR, justifyContent: 'center', alignItems: 'center', shadowColor: PRIMARY_COLOR, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8 },
  bottomText: { fontSize: 10, color: PRIMARY_COLOR, marginTop: 4, fontWeight: "600", textAlign: 'center' },
  activeText: { color: PRIMARY_COLOR, fontWeight: "700" },
});