import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Image,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Modal,
    // Import pour le feedback haptique
    Vibration, 
} from "react-native";
import axios from "axios";
import { io } from "socket.io-client";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

// ===================================================================
//       CONSTANTES DE STYLE ET API
// ===================================================================
const API_URL = "http://192.168.137.118:3000"; // ⚠️ MODIFIEZ CETTE URL VERS VOTRE SERVEUR BACKEND ⚠️
const COLOR_PALETTE = {
    primary: "#0b5a5aff", // Indigo plus vibrant (utilisé comme Bleu/Teal principal)
    secondary: "#10B981", // Vert succès
    danger: "#EF4444", // Rouge danger
    background: "#F9FAFB", // Fond très clair
    cardBg: "#FFFFFF",
    textBase: "#1F2937", // Texte sombre
    textMuted: "#6B7280", // Texte gris
    border: "#E5E7EB", // Gris clair pour les bordures
    success: "#34D399",
};
const SCREEN_WIDTH = Dimensions.get("window").width;

// Catégories pour un restaurant
const FOOD_CATEGORIES = [
    "Entrée",
    "Plat Principal",
    "Dessert",
    "Boisson",
    "Menu Enfant",
    "Spécialité du Chef",
    "Non classé",
];


// ===================================================================
//       FONCTIONS UTILITAIRES POUR LE PRIX
// ===================================================================
/**
 * Formatte le prix en tant que chaîne, supprime les zéros non significatifs (.00)
 * et utilise la virgule comme séparateur décimal si nécessaire.
 * @param {string | number} price Le prix à formater.
 * @returns {string} Le prix formaté.
 */
const formatPrice = (price) => {
    const num = parseFloat(price);
    if (isNaN(num)) return "0"; 

    // Utilise toLocaleString pour formater avec la locale 'fr-FR' (virgule décimale)
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

/**
 * Nettoie et formate l'entrée utilisateur pour les champs de prix
 * Permet uniquement les chiffres et un seul point/virgule.
 * @param {string} input L'entrée utilisateur.
 * @returns {string} L'entrée nettoyée.
 */
const formatInputPrice = (input) => {
    // 1. Remplacer les virgules par des points pour la conversion interne JavaScript
    let cleaned = input.replace(',', '.');
    
    // 2. Supprimer tous les caractères sauf les chiffres et le point
    cleaned = cleaned.replace(/[^0-9.]/g, '');

    // 3. S'assurer qu'il n'y a qu'un seul point décimal
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        // Garder la partie entière et seulement le premier point + décimales
        cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // 4. Utiliser la virgule pour l'affichage dans l'input (retourne au format FR)
    return cleaned.replace('.', ',');
};


// ===================================================================
//       COMPOSANT: PublicationCard (PAS DE CHANGEMENT MAJEUR)
// ===================================================================
const PublicationCard = React.memo(({ item, editAction, deleteAction }) => {
    const prixInitial = parseFloat(item.prix);
    const prixPromo = parseFloat(item.prixPromo);
    const hasDiscount = !isNaN(prixInitial) && !isNaN(prixPromo) && prixInitial > prixPromo;
    const discountPercent = hasDiscount
        ? Math.round(((prixInitial - prixPromo) / prixInitial) * 100)
        : 0;

    return (
        <View style={cardStyles.card}>
            {/* Image */}
            <View style={cardStyles.cardImageContainer}>
                {item.image ? (
                    <Image
                        source={{ uri: item.image }}
                        style={cardStyles.cardImage}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={cardStyles.noImage}>
                        <Ionicons name="image-outline" size={60} color={COLOR_PALETTE.textMuted} />
                    </View>
                )}
                
                {/* Badge de réduction */}
                {hasDiscount && discountPercent > 0 && (
                    <View style={cardStyles.discountBadge}>
                        <Text style={cardStyles.discountText}>-{discountPercent}%</Text>
                    </View>
                )}
            </View>

            {/* Contenu */}
            <View style={cardStyles.cardBody}>
                {/* Catégorie */}
                <Text style={cardStyles.categoryText}>{item.categorie || 'Non classé'}</Text>
                
                <Text style={cardStyles.cardTitle} numberOfLines={2}>
                    {item.nom || "Produit sans nom"}
                </Text>
                <Text style={cardStyles.cardDesc} numberOfLines={2}>
                    {item.description}
                </Text>

                {/* Prix */}
                <View style={cardStyles.priceRow}>
                    <Text style={cardStyles.newPrice}>
                        {formatPrice(item.prixPromo)} Ar 
                    </Text>
                    {hasDiscount && (
                        <Text style={cardStyles.oldPrice}>
                            {formatPrice(item.prix)} Ar 
                        </Text>
                    )}
                </View>

                {/* Actions (Ordre inversé pour mettre Modifier en avant) */}
                <View style={cardStyles.cardActions}>
                    {/* Bouton Modifier (Primaire) */}
                    <TouchableOpacity
                        style={[cardStyles.actionButton, cardStyles.editButton]}
                        onPress={() => editAction(item)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="create-outline" size={18} color={COLOR_PALETTE.primary} />
                        <Text style={cardStyles.actionButtonText}>Modifier</Text>
                    </TouchableOpacity>
                    
                    {/* Bouton Supprimer (Secondaire / Danger) */}
                    <TouchableOpacity
                        style={[cardStyles.actionButton, cardStyles.deleteButton]}
                        onPress={() => deleteAction(item.id)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="trash-outline" size={18} color={COLOR_PALETTE.danger} />
                        <Text style={[cardStyles.actionButtonText, cardStyles.deleteButtonText]}>Supprimer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
});

// ===================================================================
//       COMPOSANT: CategoryPickerModal (PAS DE CHANGEMENT MAJEUR)
// ===================================================================
const CategoryPickerModal = ({ modalVisible, onClose, onSelect, selectedCategory }) => {
    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={pickerStyles.item}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
        >
            <Text style={[pickerStyles.itemText, item === selectedCategory && pickerStyles.selectedItemText]}>
                {item}
            </Text>
            {item === selectedCategory && (
                <Ionicons name="checkmark-circle" size={24} color={COLOR_PALETTE.primary} />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={modalVisible}
            onRequestClose={onClose}
        >
            <View style={pickerStyles.centeredView}>
                <View style={pickerStyles.modalView}>
                    <Text style={pickerStyles.title}>Sélectionner une Catégorie</Text>
                    <FlatList
                        data={FOOD_CATEGORIES}
                        renderItem={renderItem}
                        keyExtractor={(item) => item}
                        style={pickerStyles.list}
                        ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
                    />
                    <TouchableOpacity 
                        style={pickerStyles.closeButton} 
                        onPress={onClose}
                    >
                        <Text style={pickerStyles.closeButtonText}>Fermer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};


// ===================================================================
//       COMPOSANT: PublicationFormModal (ERGONOMIE MAXIMALE)
// ===================================================================
const PublicationFormModal = ({ 
    modalVisible, 
    onClose, 
    form, 
    setForm, 
    editingId, 
    handleFormSubmit, 
    submitting, 
    pickImage,
    openCategoryPicker 
}) => {
    const scrollViewRef = useRef(null);
    
    // Fonction de mise à jour du prix avec formatage en temps réel
    const handlePriceChange = useCallback((field, text) => {
        const formattedText = formatInputPrice(text);
        setForm(prev => ({ ...prev, [field]: formattedText }));
    }, [setForm]);

    // Prix promotionnel nettoyé pour l'affichage du format final
    const finalPrice = useMemo(() => {
        // On remplace la virgule par un point pour que parseFloat fonctionne correctement
        const rawPrice = form.prixPromo.replace(',', '.');
        return formatPrice(rawPrice);
    }, [form.prixPromo]);


    // Fermeture avec feedback haptique
    const handleClose = () => {
        Vibration.vibrate(20); 
        onClose();
    };

    // Soumission avec feedback haptique
    const handleSubmit = () => {
        Vibration.vibrate(40);
        handleFormSubmit();
    };


    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={modalVisible}
            // Utiliser la gestion interne pour le feedback
            onRequestClose={handleClose} 
        >
            {/* 1. Clavier: 'padding' est le plus fiable pour garantir que le champ est visible */}
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={modalStyles.centeredView}
            >
                <View style={modalStyles.modalView}>
                    {/* 2. ScrollView: Permet de faire défiler le contenu, même avec le clavier */}
                    <ScrollView
                        ref={scrollViewRef}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{ paddingBottom: 20 }}
                    >
                        <View style={formStyles.form}>
                            {/* Header du formulaire */}
                            <View style={formStyles.formHeader}>
                                <Text style={formStyles.formTitle}>
                                    {editingId ? "✏️ Modifier le produit" : "➕ Publier un nouveau produit"}
                                </Text>
                                {/* Bouton de fermeture amélioré */}
                                <TouchableOpacity onPress={handleClose} style={formStyles.closeBtn}>
                                    <Ionicons name="close-circle" size={36} color={COLOR_PALETTE.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Image Picker */}
                            <TouchableOpacity
                                style={formStyles.imagePicker}
                                onPress={pickImage}
                                activeOpacity={0.7}
                            >
                                {form.image ? (
                                    <>
                                        <Image
                                            source={{ uri: form.image }}
                                            style={formStyles.formImage}
                                            resizeMode="cover"
                                        />
                                        <View style={formStyles.imageOverlay}>
                                            <Ionicons name="camera" size={24} color="#FFF" />
                                            <Text style={formStyles.changeImageText}>Changer l'image</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={formStyles.imagePickerContent}>
                                        <Ionicons name="cloud-upload-outline" size={48} color={COLOR_PALETTE.primary} />
                                        <Text style={formStyles.imagePickerText}>
                                            Ajouter une image (Format 16:9 recommandé)
                                        </Text>
                                        <Text style={formStyles.imagePickerSubtext}>JPG, PNG</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Nom */}
                            <View style={formStyles.inputGroup}>
                                <Text style={formStyles.label}>Nom du produit (optionnel)</Text>
                                <TextInput
                                    placeholder="Ex: Tiramisu maison"
                                    style={formStyles.input}
                                    value={form.nom}
                                    onChangeText={(t) => setForm({ ...form, nom: t })}
                                    maxLength={50} // Limite de caractères ajoutée
                                />
                            </View>
                            
                            {/* SÉLECTION DE CATÉGORIE */}
                            <View style={formStyles.inputGroup}>
                                <Text style={formStyles.label}>
                                    Catégorie <Text style={formStyles.required}>*</Text>
                                </Text>
                                <TouchableOpacity 
                                    style={formStyles.pickerInput}
                                    onPress={openCategoryPicker}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[formStyles.pickerText, !form.categorie && {color: COLOR_PALETTE.textMuted}]}>
                                        {form.categorie || "Choisir une catégorie"}
                                    </Text>
                                    <Ionicons name="chevron-down-outline" size={20} color={COLOR_PALETTE.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {/* Description */}
                            <View style={formStyles.inputGroup}>
                                <Text style={formStyles.label}>
                                    Description <Text style={formStyles.required}>*</Text>
                                </Text>
                                <TextInput
                                    multiline
                                    placeholder="Décrivez votre produit... (Ingrédients, allergènes)"
                                    style={[formStyles.input, formStyles.textArea]}
                                    value={form.description}
                                    onChangeText={(t) => setForm({ ...form, description: t })}
                                    textAlignVertical="top"
                                    maxLength={200} 
                                />
                                <Text style={formStyles.charCount}>
                                    {form.description.length} / 200
                                </Text>
                            </View>

                            {/* Prix et Prix Promo */}
                            <View style={formStyles.priceContainer}>
                                <View style={[formStyles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={formStyles.label}>Prix initial (Ar)</Text>
                                    <TextInput
                                        placeholder="0,00 Ar"
                                        style={formStyles.input}
                                        keyboardType="decimal-pad"
                                        value={form.prix}
                                        onChangeText={(t) => handlePriceChange('prix', t)}
                                    />
                                </View>

                                <View style={[formStyles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={formStyles.label}>
                                        Prix promo (Ar) <Text style={formStyles.required}>*</Text>
                                    </Text>
                                    <TextInput
                                        placeholder="0,00 Ar"
                                        style={[formStyles.input, { borderColor: COLOR_PALETTE.primary }]}
                                        keyboardType="decimal-pad"
                                        value={form.prixPromo}
                                        onChangeText={(t) => handlePriceChange('prixPromo', t)}
                                    />
                                </View>
                            </View>

                            {/* 3. Affichage du prix final (UX cruciale) */}
                            <View style={formStyles.finalPriceBox}>
                                <Text style={formStyles.finalPriceLabel}>Prix Final affiché :</Text>
                                <Text style={formStyles.finalPriceText}>
                                    {finalPrice} Ar
                                </Text>
                            </View>

                            {/* Bouton Submit */}
                            <TouchableOpacity
                                style={[formStyles.submitBtn, submitting && formStyles.submitBtnDisabled]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.8}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#FFF" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name={editingId ? "save" : "send"}
                                            size={22}
                                            color="#FFF"
                                        />
                                        <Text style={formStyles.submitBtnText}>
                                            {editingId ? "Mettre à jour le produit" : "Publier le produit"}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};


// ===================================================================
//       COMPOSANT PRINCIPAL: PublicationScreen 
// ===================================================================
export default function PublicationScreen({ navigation }) {
    const [publications, setPublications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formVisible, setFormVisible] = useState(false);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        nom: "",
        description: "",
        prix: "",
        prixPromo: "",
        image: null,
        imageFile: null,
        categorie: FOOD_CATEGORIES[0], 
    });

    const flatListRef = useRef(null);

    const resetFormState = () => {
        setForm({
            nom: "",
            description: "",
            prix: "",
            prixPromo: "",
            image: null,
            imageFile: null,
            categorie: FOOD_CATEGORIES[0], 
        });
    }

    const openForm = (pub = null) => {
        if (pub) {
            // Important : Reformater les prix pour l'édition afin d'afficher la virgule dans l'input FR
            const formattedPrix = pub.prix ? pub.prix.toString().replace('.', ',') : "";
            const formattedPrixPromo = pub.prixPromo ? pub.prixPromo.toString().replace('.', ',') : "";

            setForm({
                nom: pub.nom || "",
                description: pub.description || "",
                prix: formattedPrix,
                prixPromo: formattedPrixPromo,
                image: pub.image || null,
                imageFile: null,
                categorie: pub.categorie || FOOD_CATEGORIES[0], 
            });
            setEditingId(pub.id);
        } else {
            resetFormState();
        }
        setFormVisible(true);
    };
        
    const resetForm = () => {
        setFormVisible(false);
        setEditingId(null);
        resetFormState();
    };


    // ===============================================================
    //       IMAGE PICKER → CHOIX IMAGE
    // ===============================================================
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            return Alert.alert(
                "Permission requise",
                "L'accès à la galerie est nécessaire pour sélectionner une image."
            );
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
            aspect: [16, 9],
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            setForm({
                ...form,
                image: asset.uri,
                imageFile: {
                    uri: asset.uri,
                    type: "image/jpeg",
                    name: `pub_${Date.now()}.jpg`,
                },
            });
        }
    };

    // ===============================================================
    //       FETCH INIT & SOCKETS
    // ===============================================================
    const getPublications = async () => {
        try {
            const res = await axios.get(`${API_URL}/publications`);
            setPublications(res.data);
        } catch (err) {
            Alert.alert("Erreur", "Impossible de charger les publications. Assurez-vous que le serveur est lancé.");
            console.error("Erreur de chargement des publications:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getPublications();

        const socket = io(API_URL, { transports: ["websocket"] });

        socket.on("publication_created", (pub) => {
            setPublications((p) => [pub, ...p]);
            setTimeout(() => {
                flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
        });

        socket.on("publication_updated", (pub) =>
            setPublications((p) => p.map((x) => (x.id === pub.id ? pub : x)))
        );

        socket.on("publication_deleted", ({ id }) =>
            setPublications((p) => p.filter((x) => x.id !== id))
        );

        return () => socket.disconnect();
    }, []);

    // ===============================================================
    //       CRUD LOGIC (ADAPTÉ POUR LA VIRGULE)
    // ===============================================================
    
    // Fonction utilitaire pour préparer les données du prix pour le backend
    const preparePriceForAPI = (priceString) => {
        // Remplace la virgule par un point pour que le backend le reçoive comme un nombre standard
        return priceString ? priceString.replace(',', '.') : '';
    };

    const createPublication = async () => {
        if (!form.description || !form.prixPromo || !form.categorie) {
            return Alert.alert(
                "Champs requis",
                "La catégorie, la description et le prix promo sont obligatoires."
            );
        }

        if (!form.imageFile) {
            return Alert.alert(
                "Image requise",
                "Veuillez sélectionner une image pour votre publication."
            );
        }

        setSubmitting(true);
        let data = new FormData();
        data.append("nom", form.nom);
        data.append("description", form.description);
        data.append("prix", preparePriceForAPI(form.prix));
        data.append("prixPromo", preparePriceForAPI(form.prixPromo));
        data.append("categorie", form.categorie); 
        data.append("image", form.imageFile);

        try {
            await axios.post(`${API_URL}/publications`, data, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            resetForm();
            Alert.alert("✅ Succès", "Publication créée avec succès !");
        } catch (err) {
            console.error(err.response?.data || err.message);
            Alert.alert("Erreur", "Impossible de créer la publication.");
        } finally {
            setSubmitting(false);
        }
    };

    const updatePublication = async (id) => {
        if (!form.description || !form.prixPromo || !form.categorie) {
            return Alert.alert(
                "Champs requis",
                "La catégorie, la description et le prix promo sont obligatoires."
            );
        }

        setSubmitting(true);
        let data = new FormData();
        data.append("nom", form.nom);
        data.append("description", form.description);
        data.append("prix", preparePriceForAPI(form.prix));
        data.append("prixPromo", preparePriceForAPI(form.prixPromo));
        data.append("categorie", form.categorie); 
        if (form.imageFile) {
            data.append("image", form.imageFile);
        }

        try {
            await axios.put(`${API_URL}/publications/${id}`, data, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            resetForm();
            Alert.alert("✅ Succès", "Publication modifiée avec succès !");
        } catch (err) {
            console.error(err.response?.data || err.message);
            Alert.alert("Erreur", "Impossible de modifier la publication.");
        } finally {
            setSubmitting(false);
        }
    };

    const deletePublication = (id) => {
        Alert.alert(
            "Confirmer la suppression",
            "Voulez-vous vraiment supprimer cette publication ?",
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Supprimer",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await axios.delete(`${API_URL}/publications/${id}`);
                            Alert.alert("✅ Supprimé", "Publication supprimée avec succès.");
                        } catch (err) {
                            Alert.alert("Erreur", "Impossible de supprimer la publication.");
                        }
                    },
                },
            ]
        );
    };

    const editPublication = (pub) => {
        openForm(pub);
    };

    const handleFormSubmit = () => {
        if (editingId) {
            updatePublication(editingId);
        } else {
            createPublication();
        }
    };


    // ===============================================================
    //       EMPTY STATE
    // ===============================================================
    const renderEmptyState = () => (
        <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={80} color={COLOR_PALETTE.border} />
            <Text style={styles.emptyTitle}>Rien à afficher ici</Text>
            <Text style={styles.emptyText}>
                Créez et gérez les offres spéciales de vos produits.
            </Text>
            <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => openForm()}
                activeOpacity={0.8}
            >
                <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                <Text style={styles.emptyBtnText}>Ajouter une publication</Text>
            </TouchableOpacity>
        </View>
    );

    // ===============================================================
    //       RENDER MAIN SCREEN
    // ===============================================================
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <StatusBar barStyle="light-content" backgroundColor={COLOR_PALETTE.primary} />
            
            {/* Header */}
            <View style={headerStyles.header}>
                <View>
                    <Text style={headerStyles.headerTitle}>Publications </Text>
                    <Text style={headerStyles.headerSubtitle}>
                        {publications.length} publication{publications.length > 1 ? "s" : ""} active{publications.length > 1 ? "s" : ""}.
                    </Text>
                </View>

                <TouchableOpacity
                    style={headerStyles.addBtn}
                    onPress={() => {
                        if (formVisible) resetForm();
                        else openForm();
                    }}
                    activeOpacity={0.8}
                >
                    <Ionicons
                        name={formVisible ? "close" : "add"}
                        size={28}
                        color="#FFF"
                    />
                </TouchableOpacity>
            </View>

            {/* MODAL du Formulaire */}
            <PublicationFormModal
                modalVisible={formVisible}
                onClose={resetForm}
                form={form}
                setForm={setForm}
                editingId={editingId}
                handleFormSubmit={handleFormSubmit}
                submitting={submitting}
                pickImage={pickImage}
                openCategoryPicker={() => setCategoryModalVisible(true)}
            />

            {/* MODAL du SÉLECTEUR de Catégorie */}
            <CategoryPickerModal
                modalVisible={categoryModalVisible}
                onClose={() => setCategoryModalVisible(false)}
                onSelect={(cat) => {
                    setForm({ ...form, categorie: cat });
                    setCategoryModalVisible(false);
                }}
                selectedCategory={form.categorie}
            />

            {/* Liste des publications */}
            <Text style={styles.listSectionTitle}>Publications en cours</Text>
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLOR_PALETTE.primary} />
                    <Text style={styles.loadingText}>Chargement des données...</Text>
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={publications}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <PublicationCard 
                            item={item} 
                            editAction={editPublication} 
                            deleteAction={deletePublication} 
                        />
                    )}
                    ListEmptyComponent={renderEmptyState}
                    contentContainerStyle={
                        publications.length === 0 ? styles.emptyListContainer : styles.listContent
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </KeyboardAvoidingView>
    );
}

// ===================================================================
//       STYLES - CARD
// ===================================================================
const cardStyles = StyleSheet.create({
    card: {
        backgroundColor: COLOR_PALETTE.cardBg,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 15,
        elevation: 3, 
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15, 
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: COLOR_PALETTE.border,
    },
    cardImageContainer: {
        width: '100%',
        height: 150, 
        backgroundColor: COLOR_PALETTE.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    noImage: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLOR_PALETTE.background,
    },
    discountBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: COLOR_PALETTE.danger,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        zIndex: 10,
    },
    discountText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    cardBody: {
        padding: 15,
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLOR_PALETTE.primary,
        marginBottom: 5,
        textTransform: 'uppercase',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLOR_PALETTE.textBase,
        marginBottom: 5,
    },
    cardDesc: {
        fontSize: 14,
        color: COLOR_PALETTE.textMuted,
        marginBottom: 10,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginVertical: 5,
        borderTopWidth: 1,
        borderTopColor: COLOR_PALETTE.border,
        paddingTop: 10,
    },
    newPrice: {
        fontSize: 22,
        fontWeight: '900',
        color: COLOR_PALETTE.primary,
        marginRight: 10,
        textShadowColor: 'rgba(0, 0, 0, 0.1)',
        textShadowOffset: {width: 1, height: 1},
        textShadowRadius: 1,
    },
    oldPrice: {
        fontSize: 16,
        color: COLOR_PALETTE.textMuted,
        textDecorationLine: 'line-through',
        fontWeight: '400',
    },
    cardActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
        gap: 8, 
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 10,
        flex: 1,
        justifyContent: 'center',
        borderWidth: 1,
    },
    editButton: {
        backgroundColor: COLOR_PALETTE.background,
        borderColor: COLOR_PALETTE.primary,
    },
    actionButtonText: {
        marginLeft: 5,
        fontSize: 14,
        fontWeight: '600',
        color: COLOR_PALETTE.primary,
    },
    deleteButton: {
        backgroundColor: COLOR_PALETTE.background,
        borderColor: COLOR_PALETTE.danger,
    },
    deleteButtonText: {
        color: COLOR_PALETTE.danger,
    },
});

// ===================================================================
//       STYLES - PICKER MODAL
// ===================================================================
const pickerStyles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalView: {
        margin: 20,
        backgroundColor: COLOR_PALETTE.cardBg,
        borderRadius: 10,
        width: SCREEN_WIDTH * 0.85,
        maxHeight: '70%',
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLOR_PALETTE.textBase,
        marginBottom: 15,
        textAlign: 'center',
    },
    list: {
        width: '100%',
    },
    item: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemText: {
        fontSize: 16,
        color: COLOR_PALETTE.textBase,
    },
    selectedItemText: {
        fontWeight: '700',
        color: COLOR_PALETTE.primary,
    },
    separator: {
        height: 1,
        backgroundColor: COLOR_PALETTE.border,
    },
    closeButton: {
        marginTop: 20,
        padding: 12,
        backgroundColor: COLOR_PALETTE.border,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
    },
    closeButtonText: {
        color: COLOR_PALETTE.textBase,
        fontWeight: '600',
        fontSize: 16,
    }
});


// ===================================================================
//       STYLES - FORM MODAL (AMÉLIORÉ)
// ===================================================================
const formStyles = StyleSheet.create({
    form: {
        padding: 20,
        width: '100%',
    },
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1, // Ligne de séparation ajoutée
        borderBottomColor: COLOR_PALETTE.border,
        paddingBottom: 15,
    },
    formTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: COLOR_PALETTE.primary,
    },
    closeBtn: {
        padding: 5,
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLOR_PALETTE.textBase,
        marginBottom: 6,
    },
    required: {
        color: COLOR_PALETTE.danger,
    },
    input: {
        backgroundColor: COLOR_PALETTE.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 10,
        fontSize: 16,
        color: COLOR_PALETTE.textBase,
        borderWidth: 1,
        borderColor: COLOR_PALETTE.border,
    },
    textArea: {
        height: 100,
        paddingTop: 12,
    },
    charCount: {
        fontSize: 12,
        color: COLOR_PALETTE.textMuted,
        textAlign: 'right',
        marginTop: 4,
    },
    priceContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 15,
    },
    finalPriceBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLOR_PALETTE.background,
        padding: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLOR_PALETTE.primary,
        marginBottom: 20,
    },
    finalPriceLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: COLOR_PALETTE.textBase,
    },
    finalPriceText: {
        fontSize: 20,
        fontWeight: '900',
        color: COLOR_PALETTE.primary,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLOR_PALETTE.primary,
        paddingVertical: 15,
        borderRadius: 10,
        marginTop: 20,
        elevation: 3,
    },
    submitBtnDisabled: {
        opacity: 0.6,
    },
    submitBtnText: {
        color: "#FFF",
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 10,
    },
    // Image Picker Styles
    imagePicker: {
        height: 180,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLOR_PALETTE.border,
        borderStyle: 'dashed',
        marginBottom: 20,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLOR_PALETTE.background,
    },
    imagePickerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerText: {
        fontSize: 14,
        color: COLOR_PALETTE.primary,
        fontWeight: '600',
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 10,
    },
    imagePickerSubtext: {
        fontSize: 12,
        color: COLOR_PALETTE.textMuted,
        marginTop: 4,
    },
    formImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        zIndex: 1,
    },
    imageOverlay: {
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    changeImageText: {
        color: '#FFF',
        fontWeight: '700',
        marginTop: 5,
    },
    // Picker Input Styles
    pickerInput: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLOR_PALETTE.cardBg,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLOR_PALETTE.border,
    },
    pickerText: {
        fontSize: 16,
        color: COLOR_PALETTE.textBase,
    },
});

// ===================================================================
//       STYLES - MAIN SCREEN
// ===================================================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLOR_PALETTE.background,
    },
    listSectionTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: COLOR_PALETTE.textBase,
        paddingHorizontal: 15,
        paddingVertical: 10,
        marginTop: 5,
    },
    listContent: {
        padding: 15,
        paddingBottom: 40,
    },

    // LOADING
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        minHeight: 150,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: COLOR_PALETTE.textMuted,
    },

    // EMPTY STATE
    emptyListContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 40,
        backgroundColor: COLOR_PALETTE.cardBg,
        margin: 15,
        borderRadius: 16,
        paddingVertical: 40,
        borderWidth: 1,
        borderColor: COLOR_PALETTE.border,
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: COLOR_PALETTE.textBase,
        marginTop: 20,
    },
    emptyText: {
        fontSize: 15,
        color: COLOR_PALETTE.textMuted,
        textAlign: "center",
        marginTop: 8,
        marginBottom: 24,
    },
    emptyBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLOR_PALETTE.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        elevation: 3,
    },
    emptyBtnText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "600",
        marginLeft: 8,
    },
});

// ===================================================================
//       STYLES - MODAL
// ===================================================================
const modalStyles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: "flex-end", // Alignement bas pour l'ouverture
        alignItems: "center",
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        backgroundColor: COLOR_PALETTE.background,
        borderTopLeftRadius: 20, // Coins arrondis en haut uniquement
        borderTopRightRadius: 20,
        padding: 0,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -5, // Ombre projetée vers le haut
        },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 10,
        maxHeight: '85%',
        width: '100%', // Prend toute la largeur
    },
});

// ===================================================================
//       STYLES - HEADER
// ===================================================================
const headerStyles = StyleSheet.create({
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 20,
        paddingBottom: 15,
        backgroundColor: COLOR_PALETTE.primary,
        elevation: 5,
        shadowColor: COLOR_PALETTE.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    headerTitle: {
        fontSize: 26,
        fontWeight: "900",
        color: "#FFF",
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '500',
    },
    addBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLOR_PALETTE.secondary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
    },
});