import React, { useEffect, useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Image,
    TouchableOpacity,
    StatusBar,
    Platform,
    Dimensions,
    Animated,
    Alert,
    Modal,
} from "react-native";
import axios from "axios";
import { io } from "socket.io-client";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";

// 🌐 CONFIGURATION
const API_URL = "http://192.168.137.118:3000"; // ⬅️ Adresse de base de l'API (À ajuster)
const BACKEND_API_URL = `${API_URL}`;
const { width, height } = Dimensions.get("window");

// 🎨 COULEURS
const PRIMARY_COLOR = "#008080"; // Teal foncé/Cyan foncé
const BUTTON_COLOR = "#FF4500"; // Orange Rouge pour les promotions/badges
const CARD_COLOR = "#FFFFFF"; // Fond de carte
const TEXT_COLOR_DARK = "#1A1A1A"; // Texte principal
const TOAST_SUCCESS_COLOR = "#38A169"; // Vert pour la notification
const BACKGROUND_COLOR = "#F4F7F9"; // Fond léger

// ===================================================================
// 💡 UTILITAIRES pour la Commande
// ===================================================================

/**
 * Détermine le prix de l'article (prix promo si applicable, sinon prix normal).
 * @param {object} item - L'objet article.
 * @returns {number} Le prix unitaire à utiliser.
 */
const getItemPrice = (item) => item.prixPromo && item.prixPromo < item.prix ? item.prixPromo : item.prix || 0;

/**
 * Récupère le nom de l'article.
 * @param {object} item - L'objet article.
 * @returns {string} Le nom de l'article.
 */
const getItemName = (item) => item.nom || "Article Inconnu";

/**
 * Fonction utilitaire pour le format monétaire.
 * @param {number} amount - Le montant.
 * @returns {string} Le montant formaté avec la devise.
 */
const formatMoney = (amount) => (amount || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
}) + ' Ar';

// ===================================================================
// 🍞 COMPOSANT: ToastNotification
// ===================================================================
const ToastNotification = ({ message, type = 'success' }) => {
    const topAnim = useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        if (message) {
            Animated.sequence([
                Animated.timing(topAnim, {
                    toValue: 10,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(4000),
                Animated.timing(topAnim, {
                    toValue: -100,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [message, topAnim]);

    if (!message) return null;

    const backgroundColor = type === 'success' ? TOAST_SUCCESS_COLOR : PRIMARY_COLOR;

    return (
        <Animated.View
            style={[
                toastStyles.toastContainer,
                {
                    backgroundColor: backgroundColor,
                    transform: [{ translateY: topAnim }],
                    top: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 45,
                }
            ]}
        >
            <FontAwesome name="bell" size={20} color={CARD_COLOR} />
            <Text style={toastStyles.toastText}>{message}</Text>
        </Animated.View>
    );
};

// ===================================================================
// 🛍️ COMPOSANT: CartModal
// ===================================================================
const CartModal = ({ isVisible, onClose, cartItems, cartItemCount, onCheckout, isProcessing, total, onRemoveItem, onUpdateQuantity }) => {
    const displayTotal = total;

    const handleCheckoutPress = () => {
        onCheckout('À Table');
    };

    // Calculer le sous-total d'une ligne d'article
    const calculateItemSubtotal = (item) => {
        // item dans cartItems a déjà le prix unitaire calculé comme 'prix'
        return item.prix * item.quantite;
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={modalStyles.centeredView}>
                <View style={modalStyles.modalView}>
                    {/* EN-TÊTE DU MODAL */}
                    <View style={modalStyles.modalHeader}>
                        <Ionicons name="cart" size={30} color={PRIMARY_COLOR} />
                        <Text style={modalStyles.modalTitle}>Votre Panier ({cartItemCount})</Text>
                        <TouchableOpacity onPress={onClose} style={modalStyles.closeButton}>
                            <Ionicons name="close-circle" size={30} color="#999" />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={modalStyles.divider} />

                    {/* LISTE DES ARTICLES */}
                    {cartItems.length > 0 ? (
                        <ScrollView style={modalStyles.cartList}>
                            {cartItems.map((item) => (
                                <View key={item.id} style={modalStyles.cartItem}>
                                    <View style={modalStyles.itemInfo}>
                                        <Text style={modalStyles.itemName} numberOfLines={1}>{item.nom}</Text>
                                        <Text style={modalStyles.itemUnitText}>{formatMoney(item.prix)} / unité</Text>
                                    </View>
                                    
                                    <View style={modalStyles.itemControls}>
                                        {/* Contrôles de Quantité */}
                                        <View style={modalStyles.quantityContainer}>
                                            <TouchableOpacity 
                                                onPress={() => onUpdateQuantity(item.id, item.quantite - 1)}
                                                disabled={item.quantite <= 1}
                                                style={[modalStyles.qtyButton, item.quantite <= 1 && modalStyles.qtyButtonDisabled]}
                                            >
                                                <Text style={modalStyles.qtyButtonText}>-</Text>
                                            </TouchableOpacity>
                                            <Text style={modalStyles.itemQuantity}>{item.quantite}</Text>
                                            <TouchableOpacity 
                                                onPress={() => onUpdateQuantity(item.id, item.quantite + 1)}
                                                style={modalStyles.qtyButton}
                                            >
                                                <Text style={modalStyles.qtyButtonText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                        
                                        {/* Sous-Total */}
                                        <Text style={modalStyles.itemPrice}>
                                            {formatMoney(calculateItemSubtotal(item))}
                                        </Text>

                                        {/* Bouton de suppression */}
                                        <TouchableOpacity onPress={() => onRemoveItem(item.id)} style={modalStyles.removeItemButton}>
                                            <Ionicons name="trash-outline" size={20} color="#E74C3C" />
                                        </TouchableOpacity>

                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={modalStyles.emptyCart}>
                            <Ionicons name="bag-handle-outline" size={60} color="#ccc" />
                            <Text style={modalStyles.emptyText}>Votre panier est vide.</Text>
                            <TouchableOpacity onPress={onClose} style={modalStyles.continueShoppingButton}>
                                <Text style={modalStyles.continueShoppingText}>Continuer mes achats</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* PIED DE PAGE (TOTAL ET BOUTON DE COMMANDE) */}
                    <View style={modalStyles.divider} />
                    <View style={modalStyles.totalContainer}>
                        <Text style={modalStyles.totalText}>Total à payer :</Text>
                        <Text style={modalStyles.totalAmount}>{formatMoney(displayTotal)}</Text>
                    </View>

                    <TouchableOpacity
                        style={[modalStyles.checkoutButton, (cartItems.length === 0 || isProcessing) && modalStyles.checkoutButtonDisabled]}
                        onPress={handleCheckoutPress}
                        disabled={cartItems.length === 0 || isProcessing}
                    >
                        {isProcessing ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <FontAwesome name="credit-card" size={20} color="#fff" />
                        )}
                        <Text style={modalStyles.checkoutButtonText}>
                            {isProcessing ? "Traitement..." : "Passer la commande"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// ===================================================================
// 🛒 COMPOSANT PRINCIPAL: PublicationScreen
// ===================================================================
export default function PublicationScreen({ navigation, route }) {
    const [publications, setPublications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [toastMessage, setToastMessage] = useState("");
    
    // ➡️ ÉTATS POUR LA GESTION DU NUMÉRO DE TABLE
    const [storedTable, setStoredTable] = useState(null);
    
    // ➡️ ÉTAT POUR LE MODAL DU PANIER
    const [isCartModalVisible, setIsCartModalVisible] = useState(false);
    
    // ➡️ ÉTATS DE COMMANDE/PANIER RÉEL
    // Structure du panier: [{ item: {id, nom, prix, ...}, qty: nombre }]
    const [cart, setCart] = useState([]); 
    const [processingPayment, setProcessingPayment] = useState(false);
    const [receipt, setReceipt] = useState(null); // Pour stocker le reçu/transaction ID

    const socketRef = useRef(null);
    const scrollViewRef = useRef(null);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // --- Fonction pour afficher le Toast ---
    const showToast = useCallback((message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(""), 5000);
    }, []);

    // Alias pour la fonction de notification
    const notify = showToast;

    // ************************************************
    // 🧠 LOGIQUE DE CALCUL DU TOTAL AVEC USEMEMO (CLÉ)
    // ************************************************
    const totalPrice = useMemo(() => 
        cart.reduce((sum, c) => sum + getItemPrice(c.item) * c.qty, 0)
    , [cart]);

    // Calcul du nombre total d'articles
    const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

    // --- Fonctions de Gestion du Panier (CRUD) ---

    /**
     * Ajoute ou incrémente un article dans le panier.
     * @param {object} item - L'article à ajouter.
     */
    const handleOrder = (item) => {
        setCart(prev => {
            const existingItemIndex = prev.findIndex(c => c.item.id === item.id);
            if (existingItemIndex > -1) {
                const newCart = [...prev];
                newCart[existingItemIndex].qty += 1;
                return newCart;
            }
            // Créer un nouvel objet avec le prix (promo ou standard) pour la clarté dans le panier
            const itemWithCalculatedPrice = {
                 ...item,
                 calculatedPrice: getItemPrice(item) 
            };
            return [...prev, { item: itemWithCalculatedPrice, qty: 1 }];
        });
        showToast(`✅ ${item.nom} ajouté au panier !`);
    };

    /**
     * Met à jour la quantité d'un article spécifique.
     * @param {string} itemId - L'ID de l'article.
     * @param {number} newQty - La nouvelle quantité.
     */
    const handleUpdateQuantity = (itemId, newQty) => {
        if (newQty <= 0) {
            handleRemoveItem(itemId);
            return;
        }

        setCart(prev => 
            prev.map(c => 
                c.item.id === itemId ? { ...c, qty: newQty } : c
            )
        );
    };

    /**
     * Supprime un article du panier.
     * @param {string} itemId - L'ID de l'article à supprimer.
     */
    const handleRemoveItem = (itemId) => {
        setCart(prev => prev.filter(c => c.item.id !== itemId));
        showToast(`🗑️ Article retiré du panier.`);
    };

    // --- Fonctions Paiement/Commande ---

    const buildItemsPayload = (cartItems) => {
        const itemsArray = cartItems.map(c => ({
            name: getItemName(c.item),
            price: getItemPrice(c.item),
            qty: c.qty,
            id: c.item.id ?? null,
        }));
        // itemsJson est nécessaire car le backend attend une chaîne JSON à l'intérieur du body
        const itemsJson = JSON.stringify(itemsArray); 
        return { itemsArray, itemsJson };
    };

    const handlePayment = async (method) => {
        if (cart.length === 0) return Alert.alert("Panier vide !", "Veuillez ajouter des articles avant de commander.");
        if (!storedTable) return Alert.alert("Erreur", "Le numéro de table n'est pas défini. Veuillez scanner un QR code de table.");
        
        setProcessingPayment(true);
        const localTxnId = Date.now().toString().slice(-6);
        const totalAmount = totalPrice;
        
        const optimisticReceipt = { id: localTxnId, date: new Date().toLocaleString(), method, amount: totalAmount, items: cart };
        setReceipt(optimisticReceipt);
        
        const { itemsJson } = buildItemsPayload(cart);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            // Utilisation de .toFixed(2) pour l'API backend si elle attend un format précis
            const totalAmountForApi = totalAmount.toFixed(2); 

            const body = {
                table_number: storedTable,
                order_name: `CMD-${localTxnId}`,
                total_amount: totalAmountForApi, 
                payment_method: method,
                status: 'Payée',
                items: itemsJson, // Chaîne JSON des articles
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
                notify(`Commande enregistrée (ID: ${backendId || localTxnId}).`);
                Alert.alert("Succès 🎉", `Commande envoyée pour ${formatMoney(totalAmount)} ! Votre ID de commande: ${backendId || localTxnId}`);
                setCart([]); // Vider le panier après succès
                setIsCartModalVisible(false); // Fermer le modal
            }
        } catch (err) {
            const errorMsg = err.name === 'AbortError' ? "La requête a expiré (Timeout)." : "Une erreur est survenue lors de l'envoi.";
            Alert.alert("Erreur Réseau", errorMsg);
            notify(`Échec envoi commande: ${errorMsg}`);
        } finally {
            setProcessingPayment(false);
        }
    };

    // --- Fetch publications et WebSocket ---
    const getPublications = async () => {
        // ... (Logique fetch publications inchangée)
        try {
            const res = await axios.get(`${API_URL}/publications`);
            setPublications(res.data);
        } catch (err) {
            console.log("Erreur fetch :", err);
        } finally {
            setLoading(false);
        }
    };

    // --- Handle Cart Press (OUVRIR LE MODAL) ---
    const handleCartPress = () => {
        setIsCartModalVisible(true);
    };

    // =========================================================
    // 🔑 LOGIQUE GESTION DU NUMÉRO DE TABLE (INCHANGÉE)
    // =========================================================
    
    const loadStoredTable = useCallback(async () => {
        try {
            const tableId = await AsyncStorage.getItem("TABLE_ID");
            if (tableId !== null) {
                setStoredTable(tableId);
            }
        } catch (e) {
            console.error("Erreur lecture AsyncStorage TABLE_ID:", e);
        }
    }, []);

    useEffect(() => {
        loadStoredTable();
        
        const processTableParam = async () => {
            if (route.params?.tableNumber) {
                const tableNumber = route.params.tableNumber.toString();
                try {
                    await AsyncStorage.setItem("TABLE_ID", tableNumber);
                    setStoredTable(tableNumber);
                    showToast(`Table N°${tableNumber} enregistrée !`);
                } catch (e) {
                    console.error("Erreur écriture AsyncStorage TABLE_ID:", e);
                    Alert.alert("Erreur", "Impossible d'enregistrer le numéro de table.");
                }
                navigation.setParams({ tableNumber: undefined });
            }
        };

        processTableParam();
    }, [route.params?.tableNumber, loadStoredTable, showToast, navigation]);

    // --- WebSocket et gestion des publications ---
    useEffect(() => {
        getPublications();

        const socket = io(API_URL, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });
        socketRef.current = socket;

        // ... (Logique Socket.io inchangée pour les événements publication_created/updated/deleted)

        socket.on("connect", () => console.log("Socket connecté:", socket.id));
        socket.on("disconnect", () => console.log("Socket déconnecté"));

        socket.on("publication_created", (pub) => {
            setPublications((prev) => {
                if (prev.find((p) => p.id === pub.id)) return prev;
                return [pub, ...prev];
            });
            setCurrentIndex(0);
            scrollViewRef.current?.scrollTo({ x: 0, animated: true });
            showToast(`🚀 Nouvelle offre publiée : ${pub.nom}...`);
            Animated.sequence([
                Animated.spring(scaleAnim, { toValue: 1.05, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
            ]).start();
        });

        socket.on("publication_updated", (pub) => {
            setPublications((prev) =>
                prev.map((p) => (p.id === pub.id ? { ...pub, _updated: true } : p))
            );
            setTimeout(() => {
                setPublications((prev) =>
                    prev.map((p) => ({ ...p, _updated: false }))
                );
            }, 2000);
        });

        socket.on("publication_deleted", ({ id }) => {
            setPublications((prev) => {
                const newPublications = prev.filter((p) => p.id !== id);
                if (newPublications.length === 0) {
                    setCurrentIndex(0);
                } else {
                    setCurrentIndex((prevIndex) => {
                        return Math.min(prevIndex, newPublications.length - 1);
                    });
                }
                return newPublications;
            });
            showToast(`🗑️ Une publication a été retirée.`);
        });

        return () => {
            socket.off("publication_created");
            socket.off("publication_updated");
            socket.off("publication_deleted");
            socket.disconnect();
        };
    }, [showToast, scaleAnim]);

    // --- Auto-scroll carousel ---
    useEffect(() => {
        if (publications.length === 0) return;

        const timer = setInterval(() => {
            setCurrentIndex((prevIndex) => {
                const cardWidthWithMargin = width * 0.9 + width * 0.1;
                const nextIndex = (prevIndex + 1) % publications.length;
                scrollViewRef.current?.scrollTo({
                    x: nextIndex * cardWidthWithMargin,
                    animated: true,
                });
                return nextIndex;
            });
        }, 10000);

        return () => clearInterval(timer);
    }, [publications.length]);

    // --- Handle scroll ---
    const handleScroll = (event) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const cardWidthWithMargin = width * 0.9 + width * 0.1;
        setCurrentIndex(Math.round(offsetX / cardWidthWithMargin));
    };

    // --- Publication Card ---
    const PublicationCard = ({ item, scaleAnim, isCurrent }) => {
        const isPromo = item.prixPromo && item.prix && item.prixPromo < item.prix;
        const priceToDisplay = getItemPrice(item);

        return (
            <Animated.View
                style={[
                    styles.carouselCard,
                    item._updated && styles.updatedCard,
                    isCurrent && currentIndex === publications.findIndex(p => p.id === item.id) && publications[0].id === item.id && { transform: [{ scale: scaleAnim }] },
                ]}
            >
                {item.image ? (
                    <View style={styles.imageContainer}>
                        <Image
                            source={{ uri: item.image }}
                            style={styles.carouselImage}
                            resizeMode="cover"
                        />
                        {isPromo && (
                            <View style={styles.promoBadge}>
                                <FontAwesome name="star" size={12} color="#fff" />
                                <Text style={styles.promoText}>PROMO</Text>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.noImageContainer}>
                        <FontAwesome name="image" size={64} color="#ccc" />
                    </View>
                )}
                <View style={styles.cardContent}>
                    <Text style={styles.nom} numberOfLines={2}>
                        {item.nom}
                    </Text>
                    <Text style={styles.desc} numberOfLines={3}>
                        {item.description}
                    </Text>

                    <View style={styles.priceContainerSolo}>
                        {isPromo && (
                            <View style={styles.oldPriceContainer}>
                                <Text style={styles.prixBarre}>{item.prix} Ar</Text>
                                <View style={styles.strikethrough} />
                            </View>
                        )}
                        {priceToDisplay !== 0 && (
                            <View style={styles.currentPriceContainer}>
                                <FontAwesome
                                    name="money"
                                    size={20}
                                    color={isPromo ? BUTTON_COLOR : PRIMARY_COLOR}
                                />
                                <Text
                                    style={[styles.prixDisplay, isPromo && styles.promoPrixDisplay]}
                                >
                                    {formatMoney(priceToDisplay)}
                                </Text>
                            </View>
                        )}
                        {isPromo && (
                            <View style={styles.savingsContainer}>
                                <Text style={styles.savingsText}>
                                    🎉 Économisez {formatMoney(item.prix - item.prixPromo)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.fullWidthOrderButton}
                        onPress={() => handleOrder(item)}
                    >
                        <FontAwesome name="cart-plus" size={20} color="#fff" />
                        <Text style={styles.orderButtonText}>Ajouter au panier</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    // --- Rendu ---
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
            <LinearGradient
                colors={[PRIMARY_COLOR, "#006666"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.topBar}
            >
                <View style={styles.topBarContent}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.topTitle}>Offres du Jour</Text>
                    </View>

                    {/* ➡️ BOUTONS D'ACTION À DROITE */}
                    <View style={styles.rightActions}>

                        {/* 1. Bouton Panier (appelle handleCartPress qui ouvre le Modal) */}
                        <TouchableOpacity
                            style={styles.headerIconBtn}
                            onPress={handleCartPress}
                        >
                            <FontAwesome name="shopping-cart" size={22} color="#fff" />
                            {cartItemCount > 0 && (
                                <View style={styles.cartBadge}>
                                    <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                    </View>

                </View>
            </LinearGradient>

            <ToastNotification message={toastMessage} type="success" />

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                    <Text style={styles.loadingText}>Chargement des publications...</Text>
                </View>
            ) : publications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <FontAwesome name="inbox" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>
                        Aucune offre spéciale disponible pour le moment.
                    </Text>
                </View>
            ) : (
                <View style={styles.carouselContainer}>
                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        contentContainerStyle={styles.scrollViewContent}
                    >
                        {publications.map((item, index) => (
                            <PublicationCard
                                key={item.id}
                                item={item}
                                scaleAnim={scaleAnim}
                                isCurrent={currentIndex === index}
                            />
                        ))}
                    </ScrollView>

                    {/* Indicateurs de pagination */}
                    <View style={styles.pagination}>
                        {publications.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.paginationDot,
                                    currentIndex === index && styles.paginationDotActive,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Compteur de position */}
                    <View style={styles.counter}>
                        <Text style={styles.counterText}>
                            {currentIndex + 1} / {publications.length}
                        </Text>
                    </View>
                </View>
            )}

            {/* 🛍️ APPEL DU MODAL DU PANIER */}
            <CartModal
                isVisible={isCartModalVisible}
                onClose={() => setIsCartModalVisible(false)}
                cartItems={cart.map(c => ({ 
                    id: c.item.id, 
                    nom: getItemName(c.item), 
                    prix: getItemPrice(c.item), 
                    quantite: c.qty 
                }))} // Passer les articles au format simple pour l'affichage
                cartItemCount={cartItemCount}
                onCheckout={handlePayment}
                isProcessing={processingPayment}
                total={totalPrice}
                onRemoveItem={handleRemoveItem} // Nouvelle prop
                onUpdateQuantity={handleUpdateQuantity} // Nouvelle prop
            />

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
                    <FontAwesome name="list" size={24} color={PRIMARY_COLOR} />
                    <Text style={styles.bottomText}>Menus</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.bottomBtn}
                    onPress={() => navigation.navigate("Publications")}
                >
                    <View style={styles.activeIndicator}>
                        <FontAwesome name="bullhorn" size={24} color="#fff" />
                    </View>
                    <Text style={[styles.bottomText, styles.activeText]}>Publi.</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// -------------------------------------------------------------------
// STYLES GLOBAUX
// -------------------------------------------------------------------

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
    },
    // --- Top Bar ---
    topBar: {
        paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 10 : 40,
        paddingBottom: 10,
        paddingHorizontal: 15,
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
    },
    topBarContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
    },
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconBadge: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: BUTTON_COLOR,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: CARD_COLOR,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconBtn: {
        marginLeft: 15,
        padding: 5,
        position: 'relative',
    },
    cartBadge: {
        position: 'absolute',
        top: -5,
        right: -5,
        backgroundColor: BUTTON_COLOR,
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cartBadgeText: {
        color: CARD_COLOR,
        fontSize: 12,
        fontWeight: 'bold',
    },
    tableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BUTTON_COLOR,
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 10,
        marginRight: 10,
    },
    tableText: {
        color: CARD_COLOR,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 5,
    },

    // --- Loading/Empty State ---
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: PRIMARY_COLOR,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    emptyText: {
        marginTop: 20,
        fontSize: 18,
        color: "#999",
        textAlign: "center",
    },

    // --- Carousel (Publications) ---
    carouselContainer: {
        flex: 1,
        paddingVertical: 20,
        position: 'relative',
    },
    scrollViewContent: {
        alignItems: "center",
        paddingHorizontal: width * 0.05,
    },
    carouselCard: {
        width: width * 0.9,
        backgroundColor: CARD_COLOR,
        borderRadius: 15,
        marginHorizontal: width * 0.05 / 2,
        marginBottom: 20,
        overflow: "hidden",
        elevation: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    updatedCard: {
        borderWidth: 3,
        borderColor: BUTTON_COLOR,
    },
    imageContainer: {
        width: "100%",
        height: height * 0.3,
        position: 'relative',
    },
    carouselImage: {
        width: "100%",
        height: "100%",
    },
    noImageContainer: {
        width: "100%",
        height: height * 0.3,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
    },
    promoBadge: {
        position: 'absolute',
        top: 15,
        left: 0,
        backgroundColor: BUTTON_COLOR,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    promoText: {
        color: CARD_COLOR,
        fontWeight: 'bold',
        marginLeft: 5,
    },
    cardContent: {
        padding: 15,
    },
    nom: {
        fontSize: 22,
        fontWeight: "900",
        color: PRIMARY_COLOR,
        marginBottom: 5,
    },
    desc: {
        fontSize: 14,
        color: TEXT_COLOR_DARK,
        marginBottom: 10,
        lineHeight: 20,
    },
    priceContainerSolo: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        marginBottom: 15,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
    oldPriceContainer: {
        position: 'relative',
        marginBottom: 5,
    },
    prixBarre: {
        fontSize: 16,
        color: '#888',
        fontStyle: 'italic',
    },
    strikethrough: {
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#888',
    },
    currentPriceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    prixDisplay: {
        fontSize: 28,
        fontWeight: "bold",
        color: PRIMARY_COLOR,
        marginLeft: 8,
    },
    promoPrixDisplay: {
        color: BUTTON_COLOR,
        fontSize: 32,
    },
    savingsContainer: {
        marginTop: 5,
        padding: 5,
        backgroundColor: '#FEE5D9', // Couleur légère pour l'économie
        borderRadius: 5,
    },
    savingsText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: BUTTON_COLOR,
    },
    fullWidthOrderButton: {
        backgroundColor: PRIMARY_COLOR,
        paddingVertical: 15,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    orderButtonText: {
        color: CARD_COLOR,
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },

    // --- Pagination ---
    pagination: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginVertical: 10,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#ccc",
        marginHorizontal: 5,
    },
    paginationDotActive: {
        backgroundColor: PRIMARY_COLOR,
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    counter: {
        position: 'absolute',
        top: 30,
        right: 25,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    counterText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },

    // --- Bottom Bar ---
    bottomBar: {
        flexDirection: "row",
        justifyContent: "space-around",
        alignItems: "center",
        backgroundColor: CARD_COLOR,
        borderTopWidth: 1,
        borderTopColor: "#ddd",
        paddingVertical: 10,
        paddingBottom: Platform.OS === 'ios' ? 25 : 10,
    },
    bottomBtn: {
        alignItems: "center",
        padding: 5,
    },
    bottomText: {
        fontSize: 12,
        color: PRIMARY_COLOR,
        marginTop: 4,
    },
    activeIndicator: {
        backgroundColor: PRIMARY_COLOR,
        padding: 8,
        borderRadius: 25,
        marginBottom: 3,
        transform: [{ translateY: -15 }],
        shadowColor: PRIMARY_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    activeText: {
        color: PRIMARY_COLOR,
        fontWeight: 'bold',
        marginTop: -10, // Remonter le texte après le bouton surélevé
    },
});

// ===================================================================
// 🧱 STYLES DU TOAST
// ===================================================================
const toastStyles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        left: 10,
        right: 10,
        zIndex: 1000,
        borderRadius: 8,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 10,
    },
    toastText: {
        color: CARD_COLOR,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 10,
        flexShrink: 1,
    }
});

// ===================================================================
// 🧱 STYLES DU MODAL (MODIFIÉS POUR LE CONTRÔLE DE QUANTITÉ)
// ===================================================================
const modalStyles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: '100%',
        maxHeight: height * 0.8,
        backgroundColor: CARD_COLOR,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 15,
    },
    modalHeader: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: TEXT_COLOR_DARK,
        flex: 1,
        textAlign: 'center',
        marginLeft: 10,
    },
    closeButton: {
        padding: 5,
    },
    divider: {
        height: 1,
        width: '100%',
        backgroundColor: '#eee',
        marginVertical: 10,
    },
    cartList: {
        width: '100%',
        maxHeight: height * 0.5,
    },
    cartItem: {
        flexDirection: 'column', // Changé pour une meilleure gestion de l'espace
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    itemInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    itemName: {
        fontSize: 16,
        fontWeight: '600',
        color: TEXT_COLOR_DARK,
        flex: 1,
        marginRight: 10,
    },
    itemUnitText: {
        fontSize: 12,
        color: '#999',
    },
    itemControls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 5,
    },
    qtyButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: BACKGROUND_COLOR,
    },
    qtyButtonDisabled: {
        backgroundColor: '#f5f5f5',
    },
    qtyButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: PRIMARY_COLOR,
    },
    itemQuantity: {
        paddingHorizontal: 15,
        fontSize: 16,
        fontWeight: '600',
        color: TEXT_COLOR_DARK,
    },
    itemPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: BUTTON_COLOR,
        flexShrink: 0,
        marginLeft: 10,
    },
    removeItemButton: {
        padding: 5,
        marginLeft: 10,
    },
    emptyCart: {
        alignItems: 'center',
        paddingVertical: 50,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
        marginTop: 15,
    },
    continueShoppingButton: {
        marginTop: 20,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: PRIMARY_COLOR,
        borderRadius: 8,
    },
    continueShoppingText: {
        color: CARD_COLOR,
        fontWeight: 'bold',
    },
    totalContainer: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
    },
    totalText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: TEXT_COLOR_DARK,
    },
    totalAmount: {
        fontSize: 24,
        fontWeight: '900',
        color: PRIMARY_COLOR,
    },
    checkoutButton: {
        width: '100%',
        backgroundColor: PRIMARY_COLOR,
        padding: 15,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    checkoutButtonDisabled: {
        backgroundColor: '#ccc',
    },
    checkoutButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
});