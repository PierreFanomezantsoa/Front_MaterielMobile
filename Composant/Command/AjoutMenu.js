import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, FlatList, TextInput, TouchableOpacity,
    StyleSheet, Image, Alert, Modal, ScrollView, ActivityIndicator,
    Platform, StatusBar, Animated, Dimensions
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import io from 'socket.io-client';

// Constantes de style
const PRIMARY_COLOR = '#008080'; // Bleu Canard/Teal
const SECONDARY_COLOR = '#188369ff'; // Vert plus soutenu
const CARD_BG = '#FFFFFF'; // Blanc pour les cartes
const BACKGROUND_LIGHT = '#F4F7F9'; // Arrière-plan très clair
const ACCENT_COLOR = '#D32F2F'; // Rouge pour les actions destructives
const TERTIARY_COLOR = '#FF9800'; // Orange pour les notifications

const { width } = Dimensions.get('window');
const BACKEND_URL = 'http://192.168.137.118:3000';

const FOOD_CATEGORIES = [
    'Entrée', 'Plat Principal', 'Dessert', 'Boisson Froide',
    'Boisson Chaude', 'Menu Enfant', 'Végétarien', 'Autres',
];

// Composant de sélection de catégorie
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
                <Ionicons name="checkmark-circle" size={20} color={PRIMARY_COLOR} />
            )}
        </TouchableOpacity>
    );

    return (
        <Modal
            animationType="slide" // Changé en 'slide' pour un effet plus doux
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
                        activeOpacity={0.8}
                    >
                        <Text style={pickerStyles.closeButtonText}>Fermer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Composant principal MenuList
export default function MenuList({ navigation }) {
    const [menuList, setMenuList] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [menuItem, setMenuItem] = useState({
        id: null,
        name: '',
        description: '',
        price: '',
        image: null,
        category: FOOD_CATEGORIES[0] || 'Autres'
    });
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [successfulCommandCount, setSuccessfulCommandCount] = useState(0);
    const [newCommandAlert, setNewCommandAlert] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const socketRef = useRef(null);

    const fetchMenu = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${BACKEND_URL}/menus`);
            const menuData = Array.isArray(response.data) ? response.data : response.data.menus || [];
            const formattedMenu = menuData.map(item => ({
                ...item,
                id: item.id || item._id,
                price: String(item.price || 0),
                name: item.name || item.nom || 'Sans nom',
                description: item.description || '',
                category: item.categorie || item.category || FOOD_CATEGORIES[0] || 'Autres',
                image: item.image ? item.image : null
            }));
            setMenuList(formattedMenu);
        } catch (error) {
            console.error('Erreur fetch menu:', error);
            Alert.alert('Erreur', 'Impossible de récupérer les plats');
        } finally {
            setLoading(false);
        }
    };

    const fetchSuccessfulCommandCount = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/commande/stats/recent-count`);
            setSuccessfulCommandCount(response.data.successful || 0);
        } catch {
            setSuccessfulCommandCount(0);
        }
    };

    useEffect(() => {
        fetchMenu();
        fetchSuccessfulCommandCount();

        if (Platform.OS === 'ios') {
            ImagePicker.requestMediaLibraryPermissionsAsync();
        }

        socketRef.current = io(BACKEND_URL);
        socketRef.current.on('connect', () => console.log('Socket connecté'));

        socketRef.current.on('commande:new', () => {
            setSuccessfulCommandCount(prev => prev + 1);

            setNewCommandAlert(true);
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.3, duration: 200, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true })
            ]).start();
            setTimeout(() => setNewCommandAlert(false), 3000);
        });

        return () => socketRef.current.disconnect();
    }, []);

    const updateField = (field, value) => setMenuItem({ ...menuItem, [field]: value });

    const pickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission requise", "L'accès à la galerie est nécessaire pour sélectionner une image.");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                let uri = result.assets[0].uri;
                if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('http')) {
                    uri = 'file://' + uri;
                }
                updateField('image', uri);
            }
        } catch (error) {
            console.error("Erreur image picker:", error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    const saveMenu = async () => {
        if (!menuItem.name.trim()) return Alert.alert("Erreur", "Le nom du plat est obligatoire");
        const priceValue = parseFloat(menuItem.price.replace(',', '.'));
        if (isNaN(priceValue) || priceValue <= 0) return Alert.alert("Erreur", "Veuillez entrer un prix valide");

        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('name', menuItem.name.trim());
            formData.append('description', menuItem.description.trim());

            formData.append('price', priceValue.toString());

            formData.append('categorie', menuItem.category || FOOD_CATEGORIES[0] || 'Autres');

            if (menuItem.image) {
                if (!menuItem.image.startsWith('http')) {
                    const uriParts = menuItem.image.split('/');
                    const fileName = uriParts[uriParts.length - 1];
                    const fileType = fileName.split('.').pop();

                    formData.append('image', {
                        uri: menuItem.image,
                        name: fileName,
                        type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
                    });
                }
            }

            const headers = { 'Content-Type': 'multipart/form-data' };

            if (isEditing) {
                await axios.patch(`${BACKEND_URL}/menus/${menuItem.id}`, formData, { headers });
            } else {
                await axios.post(`${BACKEND_URL}/menus`, formData, { headers });
            }

            Alert.alert('Succès', isEditing ? 'Plat modifié' : 'Plat ajouté');
            setModalVisible(false);
            setMenuItem({ id: null, name: '', description: '', price: '', image: null, category: FOOD_CATEGORIES[0] || 'Autres' });
            setIsEditing(false);
            fetchMenu();

        } catch (error) {
            console.error("Erreur saveMenu:", error.response?.data || error.message);
            Alert.alert('Erreur', error.response?.data?.message || 'Impossible de contacter le serveur');
        } finally {
            setLoading(false);
        }
    };

    const deleteMenu = (id) => {
        Alert.alert('Confirmation', 'Voulez-vous supprimer ce plat ?', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer', style: 'destructive', onPress: async () => {
                    try {
                        setLoading(true);
                        await axios.delete(`${BACKEND_URL}/menus/${id}`);
                        fetchMenu();
                        Alert.alert('Supprimé', 'Le plat a été supprimé.');
                    }
                    catch (error) {
                        console.error("Erreur deleteMenu:", error);
                        Alert.alert('Erreur', 'Impossible de supprimer le plat');
                    }
                    finally { setLoading(false); }
                }
            }
        ]);
    };

    const editMenu = (item) => {
        setMenuItem({
            id: item.id,
            name: item.name,
            description: item.description,
            price: String(item.price),
            image: item.image,
            category: item.category || FOOD_CATEGORIES[0] || 'Autres'
        });
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleLogout = () => {
        Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
            { text: "Annuler", style: 'cancel' },
            { text: "Déconnecter", style: "destructive", onPress: () => navigation.replace("admin") }
        ]);
    };

    const openAddModal = () => {
        setIsEditing(false);
        setMenuItem({ id: null, name: '', description: '', price: '', image: null, category: FOOD_CATEGORIES[0] || 'Autres' });
        setModalVisible(true);
    };

    const renderItem = ({ item }) => (
        <View style={styles.menuCard}>
            {item.image ? (
                <Image
                    source={{ uri: item.image.startsWith('http') ? item.image : `${BACKEND_URL}/images/${item.image}` }}
                    style={styles.menuImage}
                    resizeMode="cover"
                />
            ) : (
                <View style={[styles.menuImage, styles.placeholderImage]}>
                    <MaterialCommunityIcons name="food-variant" size={45} color="#B0BEC5" />
                </View>
            )}

            <View style={styles.menuInfo}>
                <View style={styles.menuHeaderInfo}>
                    <Text style={styles.menuName} numberOfLines={1}>{item.name}</Text>
                    {item.category && item.category !== 'Autres' ? (
                        <View style={styles.categoryBadge}>
                            <MaterialIcons name="label-outline" size={12} color={PRIMARY_COLOR} />
                            <Text style={styles.categoryText}>{item.category}</Text>
                        </View>
                    ) : null}
                </View>

                <Text style={styles.menuDesc} numberOfLines={2} ellipsizeMode="tail">
                    {item.description || 'Aucune description fournie.'}
                </Text>

                <View style={styles.menuFooterInfo}>
                    <Text style={styles.menuPrice}>
                        {parseFloat(item.price) % 1 === 0
                            ? parseInt(item.price).toLocaleString('fr-FR')
                            : parseFloat(item.price).toFixed(2).replace('.', ',')} Ar
                    </Text>
                    <View style={styles.actionButtons}>
                        <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => editMenu(item)}>
                            <Ionicons name="create-outline" size={18} color={CARD_BG} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => deleteMenu(item.id)}>
                            <Ionicons name="trash-outline" size={18} color={CARD_BG} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}> Gestion Menu</Text>
                </View>

                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => {
                            setSuccessfulCommandCount(0);
                            navigation.navigate("listecommande");
                        }}
                    >
                        <Ionicons name="receipt-outline" size={24} color={CARD_BG} />
                        {successfulCommandCount > 0 && (
                            <Animated.View
                                style={[styles.badge, { backgroundColor: TERTIARY_COLOR }, newCommandAlert && { transform: [{ scale: scaleAnim }] }]}
                            >
                                <Text style={styles.badgeText}>{successfulCommandCount}</Text>
                            </Animated.View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.headerIconBtn}
                        onPress={() => {
                            navigation.navigate("adminPublication");
                        }}
                    >
                        <MaterialCommunityIcons name="bullhorn" size={24} color={CARD_BG} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.headerIconBtn, { marginLeft: 10 }]} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={24} color={CARD_BG} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading && menuList.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={PRIMARY_COLOR} />
                    <Text style={styles.loadingText}>Chargement des plats...</Text>
                </View>
            ) : menuList.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons name="food-off" size={80} color="#B0BEC5" />
                    <Text style={styles.emptyText}>Aucun plat disponible. Ajoutez-en un !</Text>
                </View>
            ) : (
                <FlatList
                    data={menuList}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.flatListContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.8}>
                <Ionicons name="add" size={30} color={CARD_BG} />
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" onRequestClose={() => setModalVisible(false)} transparent={true}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{isEditing ? 'Modifier le plat' : 'Nouveau plat'}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalBtn}>
                                    <Ionicons name="close-circle" size={30} color={ACCENT_COLOR} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalContent}>
                                <Text style={styles.label}>Nom <Text style={styles.required}>*</Text></Text>
                                <TextInput value={menuItem.name} onChangeText={text => updateField('name', text)} style={styles.input} placeholder="Nom du plat/boisson" />

                                <Text style={styles.label}>Catégorie <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity
                                    style={styles.pickerInput}
                                    onPress={() => setCategoryModalVisible(true)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.pickerText}>
                                        {menuItem.category || "Sélectionner une catégorie"}
                                    </Text>
                                    <Ionicons name="chevron-forward-outline" size={20} color={'#666'} />
                                </TouchableOpacity>

                                <Text style={styles.label}>Prix (Ar) <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    keyboardType="numeric" // Remplacé par numeric
                                    value={menuItem.price}
                                    onChangeText={text => updateField('price', text.replace(/[^0-9,.]/g, ''))} // Permet seulement chiffres, virgule et point
                                    style={styles.input}
                                    placeholder="0.00"
                                />

                                <Text style={styles.label}>Description</Text>
                                <TextInput
                                    value={menuItem.description}
                                    onChangeText={text => updateField('description', text)}
                                    style={[styles.input, styles.multilineInput]}
                                    multiline
                                    placeholder="Décrivez brièvement le plat..."
                                />

                                <TouchableOpacity onPress={pickImage} style={styles.imagePickerBtn} activeOpacity={0.8}>
                                    <Ionicons name="image-outline" size={20} color={CARD_BG} />
                                    <Text style={styles.imagePickerText}>{menuItem.image ? "Modifier l'image" : "Ajouter une image"}</Text>
                                </TouchableOpacity>
                                {menuItem.image && (
                                    <View style={styles.imagePreviewContainer}>
                                        <Image
                                            source={{ uri: menuItem.image.startsWith('http') && !menuItem.image.includes('file://') ? menuItem.image : menuItem.image }}
                                            style={styles.imagePreview}
                                            resizeMode="cover"
                                        />
                                    </View>
                                )}

                                <TouchableOpacity onPress={saveMenu} style={styles.submitBtn} disabled={loading} activeOpacity={0.8}>
                                    {loading ? (
                                        <ActivityIndicator color={CARD_BG} />
                                    ) : (
                                        <Text style={styles.submitBtnText}>{isEditing ? 'Enregistrer les modifications' : 'Ajouter le plat'}</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <CategoryPickerModal
                modalVisible={categoryModalVisible}
                onClose={() => setCategoryModalVisible(false)}
                onSelect={(cat) => {
                    setMenuItem({ ...menuItem, category: cat });
                    setCategoryModalVisible(false);
                }}
                selectedCategory={menuItem.category}
            />
        </View>
    );
}

// ------------------- STYLES AMÉLIORÉS -------------------
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: BACKGROUND_LIGHT },

    // Header (En-tête)
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 50,
        paddingBottom: 15,
        backgroundColor: PRIMARY_COLOR,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: CARD_BG,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconBtn: {
        marginLeft: 15,
        position: 'relative',
        padding: 5,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 3,
        borderWidth: 1, // Ajout de bordure pour mieux contraster
        borderColor: CARD_BG,
    },
    badgeText: { color: CARD_BG, fontSize: 11, fontWeight: 'bold' },

    // Floating Action Button (FAB)
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 65,
        height: 65,
        borderRadius: 32.5,
        backgroundColor: SECONDARY_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: SECONDARY_COLOR,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        zIndex: 10,
    },

    // Card de Menu
    menuCard: {
        flexDirection: 'row',
        backgroundColor: CARD_BG,
        marginHorizontal: 15,
        marginVertical: 8,
        borderRadius: 15,
        overflow: 'hidden',
        elevation: 4, // Android shadow
        shadowColor: '#000', // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
    },
    menuImage: {
        width: 100,
        height: '100%', // Utilisation de toute la hauteur de la carte
        borderTopLeftRadius: 15,
        borderBottomLeftRadius: 15,
    },
    placeholderImage: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BACKGROUND_LIGHT,
    },
    menuInfo: {
        flex: 1,
        padding: 15,
        justifyContent: 'space-between',
    },
    menuHeaderInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 5,
    },
    menuName: {
        fontWeight: '900', // Plus gras pour le nom
        fontSize: 17,
        flex: 1,
        color: '#333',
        marginRight: 10,
    },
    menuDesc: {
        fontSize: 13,
        color: '#777',
        marginBottom: 8,
    },
    menuFooterInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
    },
    menuPrice: {
        fontWeight: 'bold',
        fontSize: 16,
        color: PRIMARY_COLOR,
    },
    actionButtons: {
        flexDirection: 'row',
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
        marginLeft: 10,
    },
    editBtn: { backgroundColor: SECONDARY_COLOR },
    deleteBtn: { backgroundColor: ACCENT_COLOR },
    
    // Autres styles
    flatListContent: {
        paddingTop: 10,
        paddingBottom: 100,
    },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { marginTop: 15, fontSize: 16, color: '#666', textAlign: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0F2F1',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 15,
    },
    categoryText: { fontSize: 11, color: PRIMARY_COLOR, marginLeft: 4, fontWeight: '600' },

    // Modal de formulaire
    centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalView: { width: width - 40, backgroundColor: CARD_BG, borderRadius: 15, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: PRIMARY_COLOR },
    closeModalBtn: { padding: 5 },
    modalContent: { marginTop: 5 },
    label: { fontWeight: '700', marginTop: 15, marginBottom: 5, fontSize: 14, color: '#333' },
    required: { color: ACCENT_COLOR },
    input: {
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        backgroundColor: BACKGROUND_LIGHT,
    },
    multilineInput: { minHeight: 80, textAlignVertical: 'top' },
    pickerInput: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        padding: 12,
        backgroundColor: BACKGROUND_LIGHT,
    },
    pickerText: { fontSize: 15, color: '#333' },
    imagePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: SECONDARY_COLOR,
        padding: 12,
        borderRadius: 8,
        marginTop: 20,
        justifyContent: 'center',
        elevation: 2,
    },
    imagePickerText: { color: CARD_BG, marginLeft: 8, fontWeight: 'bold', fontSize: 16 },
    imagePreviewContainer: { marginTop: 15, alignItems: 'center' },
    imagePreview: { width: '100%', height: 180, borderRadius: 10, borderWidth: 1, borderColor: '#CCC' },
    submitBtn: {
        marginTop: 25,
        backgroundColor: PRIMARY_COLOR,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        elevation: 3,
    },
    submitBtnText: { color: CARD_BG, fontWeight: 'bold', fontSize: 17 },
});

const pickerStyles = StyleSheet.create({
    centeredView: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }, // Changé pour apparaître en bas
    modalView: {
        backgroundColor: CARD_BG,
        width: '100%',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        maxHeight: '60%', // Limite la hauteur
    },
    title: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: PRIMARY_COLOR, textAlign: 'center' },
    list: { maxHeight: 200 },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
    },
    itemText: { fontSize: 16, color: '#333' },
    selectedItemText: { fontWeight: 'bold', color: PRIMARY_COLOR },
    separator: { height: 1, backgroundColor: BACKGROUND_LIGHT, marginHorizontal: 15 },
    closeButton: {
        marginTop: 20,
        backgroundColor: ACCENT_COLOR,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
    },
    closeButtonText: { color: CARD_BG, fontWeight: 'bold', fontSize: 16 },
});