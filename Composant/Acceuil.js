import React, { useState, useRef, useEffect } from 'react';
import {
    TouchableOpacity, StyleSheet, Text, View,
    Modal, ScrollView, Dimensions, Animated, StatusBar, Platform
} from 'react-native';
import { FontAwesome, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

// Constantes de design pour une IHM cohérente
const PRIMARY_COLOR = '#008080'; // Teal (Bleu-vert)
const SECONDARY_COLOR = '#004D40'; // Teal foncé pour le logo
const ACCENT_COLOR = '#D32F2F'; // Rouge pour l'annulation
const BUTTON_PROMO_COLOR = '#085344ff'; // Orange vif pour les promotions
const BACKGROUND_LIGHT = '#F0F5F5'; // Arrière-plan très clair
const CARD_BG = '#FFFFFF'; // Fond blanc pour les cartes
const CARD_BG1 = '#352727ff'; // Fond blanc pour les cartes

const { height, width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? StatusBar.currentHeight : 0;


export default function Accueil({ navigation }) {

    const [showTables, setShowTables] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current; // Animation pour l'icône

    // Animation de pulsation légère pour l'icône du centre
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);


    // ✅ Enregistrer le numéro de table et passer à la page menuList
    const selectTable = async (tableNumber) => {
        try {
            await AsyncStorage.setItem('TABLE_ID', tableNumber.toString());
            console.log("Table enregistrée :", tableNumber);

            setShowTables(false);
            navigation.navigate('menuList', { tableNumber }); 
        } catch (error) {
            console.log("Erreur stockage table :", error);
        }
    };

    const TABLE_COUNT = 15; // Nombre de tables
    const tables = [...Array(TABLE_COUNT).keys()].map(i => i + 1);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />

            {/* Zone de tête stylisée et semi-circulaire */}
            {/* Utilisation de LinearGradient pour un header plus riche */}
            <LinearGradient
                colors={[PRIMARY_COLOR, SECONDARY_COLOR]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerBlock}
            >
                {/* Décoration d'arrière-plan */}
                <View style={styles.headerDecoration1} />
                <View style={styles.headerDecoration2} />
                
                {/* Boutons de navigation/Fonctions rapides */}
                <View style={styles.headerNav}>
                    {/* Bouton Publications (pour voir les offres) */}
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => navigation.navigate("Publications")}
                    >
                        <FontAwesome name="bullhorn" size={22} color="#fff" />
                    </TouchableOpacity>

                    {/* Titre central */}
                    <Text style={styles.headerTitle}>Accueil Client</Text>

                    {/* Bouton Admin (engrenage) */}
                    {/* Mondifier ici pour mettre clique si lancer dans page web cette application */}
                    <TouchableOpacity
                        style={styles.navButton}
                        onPress={() => navigation.navigate("admin")}
                    >
                        <Ionicons name="log-in-outline" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

            </LinearGradient>

            {/* Contenu principal */}
            <View style={styles.mainContent}>

                {/* Logo/Illustration Centrée avec animation */}
                <View style={styles.illustrationContainer}>
                    <Animated.View style={[styles.iconCircle, { transform: [{ scale: pulseAnim }] }]}>
                        <MaterialCommunityIcons name="silverware-fork-knife" size={70} color={BACKGROUND_LIGHT} />
                    </Animated.View>
                    <Text style={styles.logoText}>Grande Hotel</Text>
                    <Text style={styles.logoSubtext}>Restaurant</Text>
                </View>

                {/* Carte de Bienvenue */}
                <View style={styles.welcomeCard}>
                    <Text style={styles.mainText}>
                        Bienvenue dans votre{'\n'}
                        <Text style={styles.highlightText}>Menu Numérique</Text>
                    </Text>
                    <View style={styles.divider} />
                    <Text style={styles.subtitleText}>
                        Passez votre commande facilement et profitez d'un service rapide et personnalisé.
                    </Text>

                    {/* Fonctionnalités rapides */}
                    <View style={styles.featuresContainer}>
                        <View style={styles.featureItem}>
                            <Ionicons name="fast-food-outline" size={24} color={BUTTON_PROMO_COLOR} />
                            <Text style={styles.featureText}>Menu complet</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="time-outline" size={24} color={PRIMARY_COLOR} />
                            <Text style={styles.featureText}>Service rapide</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <Ionicons name="card-outline" size={24} color={SECONDARY_COLOR} />
                            <Text style={styles.featureText}>Paiement facile</Text>
                        </View>
                    </View>
                </View>

            </View>

            {/* Bas de page : Barre d'action */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => setShowTables(true)}
                    activeOpacity={0.85}
                >
                    <Text style={styles.startButtonText}>Commencer la Commande</Text>
                    <View style={styles.buttonIconContainer}>
                        <Ionicons name="arrow-forward" size={24} color="white" />
                    </View>
                </TouchableOpacity>

                <Text style={styles.projectTitle}>Projet - Restaurant Numérique</Text>
            </View>

            {/* MODAL - Choix de la table (Amélioré) */}
            <Modal visible={showTables} transparent animationType="slide" onRequestClose={() => setShowTables(false)}>
                <View style={styles.modalBackground}>
                    <View style={styles.modalBox}>
                        {/* En-tête modal */}
                        <View style={styles.modalHeader}>
                            <View style={styles.modalIconContainer}>
                                <MaterialCommunityIcons name="table-chair" size={40} color={PRIMARY_COLOR} />
                            </View>
                            <Text style={styles.modalTitle}>Sélectionnez votre table</Text>
                            <Text style={styles.modalSubtitle}>
                                Choisissez le numéro de votre table pour continuer votre commande
                            </Text>
                        </View>

                        {/* Grille des tables */}
                        <ScrollView 
                            contentContainerStyle={styles.tablesGrid}
                            showsVerticalScrollIndicator={false}
                        >
                            {tables.map((number) => (
                                <TouchableOpacity
                                    key={number}
                                    style={styles.tableBtn}
                                    onPress={() => selectTable(number)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.tableBtnInner}>
                                        <Ionicons name="restaurant-outline" size={22} color={PRIMARY_COLOR} />
                                        <Text style={styles.tableText}>Table</Text>
                                        <Text style={styles.tableNumber}>{number}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Bouton Annuler */}
                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setShowTables(false)}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close-circle-outline" size={20} color={ACCENT_COLOR} />
                            <Text style={styles.closeBtnText}>Annuler</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

/* ------------------------------------------
            STYLES ERGONOMIQUES
------------------------------------------- */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_LIGHT,
    },
    
    // --- Haut de page décoratif ---
    headerBlock: {
        position: 'absolute',
        top: 0,
        width: '100%',
        height: height * 0.40,
        paddingTop: STATUS_BAR_HEIGHT + 10, // Ajout de l'espace pour la barre d'état
        borderBottomLeftRadius: 60,
        borderBottomRightRadius: 60,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    headerNav: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    headerTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    navButton: {
        padding: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerDecoration1: {
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerDecoration2: {
        position: 'absolute',
        bottom: -30,
        left: -30,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    
    // --- Contenu Principal ---
    mainContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: height * 0.08,
        paddingHorizontal: 20
    },
    
    // --- Logo/Illustration ---
    illustrationContainer: {
        marginBottom: 30,
        alignItems: 'center',
        justifyContent: 'center',
        // Remonte le logo au-dessus du bloc de bienvenue
        marginTop: STATUS_BAR_HEIGHT + 30, 
    },
    iconCircle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: SECONDARY_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 15, 
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        borderWidth: 5,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        marginBottom: 15,
    },
    logoText: {
        color: CARD_BG1,
        fontSize: 28,
        marginTop: 15,
        fontWeight: '900',
        letterSpacing: 1,
    },
    logoSubtext: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 2,
    },

    // --- Carte de Bienvenue ---
    welcomeCard: {
        backgroundColor: CARD_BG,
        borderRadius: 25,
        padding: 25,
        width: '100%',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        marginTop: 20,
    },
    mainText: {
        fontSize: 24,
        fontWeight: '700', 
        color: '#333',
        textAlign: 'center',
        lineHeight: 32,
    },
    highlightText: {
        fontWeight: '900',
        color: PRIMARY_COLOR,
    },
    divider: {
        height: 3,
        width: 60,
        backgroundColor: PRIMARY_COLOR,
        alignSelf: 'center',
        marginVertical: 15,
        borderRadius: 2,
    },
    subtitleText: {
        fontSize: 15,
        color: '#666',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },

    // --- Fonctionnalités ---
    featuresContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    featureItem: {
        alignItems: 'center',
        flex: 1,
    },
    featureText: {
        fontSize: 11,
        color: '#666',
        marginTop: 6,
        textAlign: 'center',
        fontWeight: '600',
    },

    // --- Barre d'Action (Bottom Bar) ---
    bottomBar: {
        backgroundColor: CARD_BG,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 30 : 20,
        alignItems: 'center',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BUTTON_PROMO_COLOR, // Changement pour plus de contraste/urgence
        paddingHorizontal: 30,
        paddingVertical: 18,
        borderRadius: 30,
        width: '100%',
        elevation: 8,
        shadowColor: BUTTON_PROMO_COLOR,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.6, // Augmentation de l'ombre
        shadowRadius: 10,
    },
    startButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
        flex: 1,
        textAlign: 'center',
    },
    buttonIconContainer: {
        position: 'absolute',
        right: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
        padding: 6,
    },
    projectTitle: {
        fontSize: 12,
        color: '#999',
        fontWeight: '500',
        marginTop: 15,
        textAlign: 'center',
    },

    // --- MODAL Styles ---
    modalBackground: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalBox: {
        width: '100%',
        maxWidth: 450,
        maxHeight: '90%',
        backgroundColor: CARD_BG,
        borderRadius: 30,
        paddingBottom: 25,
        elevation: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    modalHeader: {
        alignItems: 'center',
        paddingTop: 30,
        paddingHorizontal: 25,
        paddingBottom: 20,
    },
    modalIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: `${PRIMARY_COLOR}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: SECONDARY_COLOR,
        marginBottom: 10,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#777',
        textAlign: 'center',
        lineHeight: 20,
    },
    
    // --- Grille des Tables ---
    tablesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        paddingHorizontal: 15,
        paddingVertical: 20,
    },
    tableBtn: {
        width: (width - 120) / 3, // 3 colonnes avec espacement
        aspectRatio: 1,
        margin: 6,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 5,
    },
    tableBtnInner: {
        flex: 1,
        backgroundColor: CARD_BG,
        borderWidth: 2,
        borderColor: PRIMARY_COLOR,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    tableText: {
        color: '#666',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 6,
    },
    tableNumber: {
        color: PRIMARY_COLOR,
        fontSize: 28,
        fontWeight: '900',
        marginTop: 2,
    },
    
    // --- Bouton Annuler ---
    closeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 30,
        marginHorizontal: 25,
        marginTop: 10,
        borderRadius: 15,
        backgroundColor: `${ACCENT_COLOR}10`,
    },
    closeBtnText: {
        color: ACCENT_COLOR,
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 8,
    },

    // --- Anciens styles non utilisés mais laissés pour référence ---
    bottomBtn: { display: 'none' },
    activeIndicator: { display: 'none' },
    bottomText: { display: 'none' },
    activeText: { display: 'none' },
});