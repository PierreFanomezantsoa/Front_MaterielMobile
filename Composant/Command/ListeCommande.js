import React, { useEffect, useState, useRef, memo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
  Animated,
  Alert,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Nouveaux imports pour l'impression et le QR Code
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import QRCodeSvg from "react-native-qrcode-svg";
import Svg, { Path } from 'react-native-svg'; // Nécessaire pour QRCodeSvg

const API_URL = "http://192.168.137.118:3000"; // <-- change ici si besoin

const COLORS = {
  primary: "#008080",
  colorQnt: "#d55937ff",
  success: "#4CAF50",
  warning: "#FFA500",
  danger: "#FF4D4D",
  light: "#F4F7F9",
  cleanWhite: "#FFFFFF", // Renommé pour éviter confusion si 'white' est utilisé pour l'UI
  dark: "#1a1a1a",
  white: "#FFFFFF",
  gray: "#E0E0E0",
  text: "#333333",
  printBtn: "#1a73e8",
};

const STATUS_COLORS = {
  "En attente": "#FFB74D",
  "En cours": "#2196F3",
  Prête: "#4CAF50",
  Payée: "#00796B",
  Livrée: "#689F38",
  Annulée: "#F44336",
};

// --- FONCTION POUR LE REÇU HTML AVEC QR CODE INJECTÉ ---
const generateReceiptHtml = (order, qrCodeDataUri) => {
  const items = (() => {
    try {
      return typeof order.items === "string" ? JSON.parse(order.items) : order.items || [];
    } catch {
      return [];
    }
  })();

  const itemsHtml = items
    .map(
      (product) => `
    <tr class="item-row">
      <td class="item-name">${product.name}</td>
      <td class="item-qty">x ${product.qty}</td>
      <td class="item-price">${(product.price * product.qty).toFixed(0)} Ar</td>
    </tr>
  `
    )
    .join("");

  const qrCodeValue = JSON.stringify({
    orderId: order.id,
    amount: order.total_amount,
    date: order.created_at,
  });
  
  // Balise <img> avec l'image Base64 injectée
  const qrCodeImage = `<img src="${qrCodeDataUri}" style="width: 100px; height: 100px; margin: 0 auto; display: block;" />`;


  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          .receipt { border: 1px dashed #000; padding: 15px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h1 { font-size: 20px; margin: 0; color: ${COLORS.primary}; }
          .info-line { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .items-table th, .items-table td { padding: 8px 0; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
          .item-row .item-qty { text-align: center; }
          .item-row .item-price { text-align: right; font-weight: bold; color: ${COLORS.success}; }
          .total { margin-top: 15px; font-size: 16px; font-weight: bold; text-align: right; border-top: 2px solid #333; padding-top: 10px; }
          .qr-code-container { text-align: center; margin: 20px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
          .qr-data { font-size: 8px; margin-top: 5px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>REÇU DE COMMANDE</h1>
            <p>Date: ${new Date(order.created_at).toLocaleDateString("fr-FR")}</p>
            <p>Heure: ${new Date(order.created_at).toLocaleTimeString("fr-FR")}</p>
          </div>

          <div class="info-line"><span>Référence Commande:</span><span>${order.id}</span></div>
          <div class="info-line"><span>Table:</span><span>${order.table_number}</span></div>
          <div class="info-line"><span>Statut:</span><span style="color: ${STATUS_COLORS[order.status] || COLORS.primary};">${order.status}</span></div>
          ${
            order.order_number
              ? `<div class="info-line"><span>N° de commande:</span><span>${order.order_number}</span></div>`
              : ""
          }

          <table class="items-table">
            <thead>
              <tr>
                <th>Article</th>
                <th style="text-align: center;">Quantité</th>
                <th style="text-align: right;">Montant</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total">TOTAL: ${order.total_amount} Ar</div>
          
          <div class="qr-code-container">
            ${qrCodeImage}
          </div>
          
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
            Merci de votre commande !
          </div>
        </div>
      </body>
    </html>
  `;
};

// --- FONCTION POUR IMPRIMER/PARTAGER LE REÇU ---
const printReceipt = async (order, qrCodeRef) => {
  try {
    const qrCodeValue = JSON.stringify({
        orderId: order.id,
        amount: order.total_amount,
        date: order.created_at,
    });
    
    // 1. Générer le Data URI Base64 à partir de la référence
    let qrCodeDataUri = '';
    
    await new Promise((resolve) => {
        if (qrCodeRef.current) {
            qrCodeRef.current.toDataURL((data) => {
                // Pour éviter l'erreur si le QR code est trop petit ou non initialisé
                if (data && data.length > 50) { 
                    qrCodeDataUri = `data:image/png;base64,${data}`;
                } else {
                    console.warn("QR Code Data URI is too short, using placeholder.");
                    qrCodeDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0BMVEUAAAD///+GZq+qAAAADElEQVQIW2NkYGAAAAAEAAIqX9XSAAAAAElFTkSuQmCC'; // Placeholder 1x1 pixel transparent
                }
                resolve();
            });
        } else {
            console.warn("QR Code ref not ready, using placeholder.");
            qrCodeDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0BMVEUAAAD///+GZq+qAAAADElEQVQIW2NkYGAAAAAEAAIqX9XSAAAAAElFTkSuQmCC';
            resolve();
        }
    });

    // 2. Générer le HTML avec le Data URI
    const htmlContent = generateReceiptHtml(order, qrCodeDataUri); 

    if (Platform.OS === "web") {
      const printWindow = window.open("", "Print Window");
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    } else {
      // Pour mobile (iOS/Android)
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      if (uri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: `Reçu Commande ${order.id}`,
            UTI: "public.pdf",
          });
        } else {
          await Print.printAsync({ uri });
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur d'impression:", error);
    Alert.alert("Erreur d'impression", "Impossible de générer ou d'imprimer le reçu.");
  }
};
// --- FIN DES FONCTIONS ---

export default function CommandeScreen({ navigation }) {
  const [commandes, setCommandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const socketRef = useRef(null);
  
  // REFÉRENCE POUR LE QR CODE MASQUÉ
  const qrCodeRef = useRef(null); 
  // Données de base pour le QR Code masqué (pour que le composant se monte)
  const defaultQrCodeValue = JSON.stringify({ id: 0, amount: 0, date: new Date().toISOString() });


  // Fetch initial commandes
  const fetchCommandes = async () => {
    try {
      const res = await axios.get(`${API_URL}/commande`);
      const storedNew = JSON.parse((await AsyncStorage.getItem("newCommandes")) || "{}");

      const data = res.data.map((c) => ({
        ...c,
        isNew: !!storedNew[c.id],
      }));

      setCommandes(data);
    } catch (e) {
      console.log("❌ fetchCommandes error:", e);
      Alert.alert("Erreur", "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommandes();

    // init socket
    (async () => {
      let userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        userId = `user-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await AsyncStorage.setItem("userId", userId);
      }

      if (socketRef.current && socketRef.current.connected) return;

      const socket = io(API_URL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        forceNew: true,
        auth: { userId },
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("📡 socket connected:", socket.id);
      });

      socket.on("commande:new", async (newCommande) => {
        const withFlag = { ...newCommande, isNew: true };

        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.07, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
        ]).start();

        setCommandes((prev) => [withFlag, ...prev]);

        const storedNew = JSON.parse((await AsyncStorage.getItem("newCommandes")) || "{}");
        storedNew[newCommande.id] = Date.now();
        await AsyncStorage.setItem("newCommandes", JSON.stringify(storedNew));
      });

      socket.on("commande:update", (updated) => {
        console.log("🔄 commande:update", updated);
        setCommandes((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, isNew: c.isNew } : c)));
      });

      socket.on("commande:delete", (id) => {
        console.log("🗑 commande:delete", id);
        setCommandes((prev) => prev.filter((c) => c.id !== id));
      });

      socket.on("connect_error", (err) => {
        console.log("⚠️ connect_error", err.message);
      });

      // cleanup
      return () => {
        socket.disconnect();
      };
    })();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCommandes();
  };

  const filteredCommandes = commandes.filter((item) => {
    if (filter === "all") return true;
    if (filter === "new") return item.isNew;
    if (filter === "pending") return item.status !== "Livrée";
    return true;
  });

  const getStatusIcon = (status) => {
    const icons = {
      "En attente": "clock-outline",
      "En cours": "chef-hat",
      Prête: "check-circle-outline",
      Payée: "credit-card",
      Livrée: "truck-check",
      Annulée: "close-circle-outline",
    };
    return icons[status] || "help-circle-outline";
  };

  const CommandeCard = memo(({ item }) => {
    const items = (() => {
      try {
        return typeof item.items === "string" ? JSON.parse(item.items) : item.items || [];
      } catch {
        return [];
      }
    })();
    
    // Nouvelle Condition pour activer le bouton d'impression :
    // Vrai si (Statut est Payée OU Livrée) ET (isNew est FAUX)
    const isPrintEnabled = (item.status === "Payée" || item.status === "Livrée") && !item.isNew;

    // --- MODIFICATION DANS handleValidate ---
    const handleValidate = async () => {
      // 1. Mettre à jour le statut LOCALEMENT à 'Payée' et définir isNew à false
      setCommandes((prev) => prev.map((c) => 
          (c.id === item.id 
              ? { 
                  ...c, 
                  isNew: false, // Désactive le badge "Nouveau" et active le bouton d'impression après validation
                  status: "Payée" // Force le statut local à "Payée"
                } 
              : c)));

      // 2. Désactiver le stockage local pour le badge "Nouveau"
      const stored = JSON.parse((await AsyncStorage.getItem("newCommandes")) || "{}");
      delete stored[item.id];
      await AsyncStorage.setItem("newCommandes", JSON.stringify(stored));
      
      Alert.alert("Commande Validée", "Le statut a été mis à jour localement à 'Payée'. Le reçu peut être imprimé.");
    };
    // -------------------------

    const handlePrint = () => {
      if (isPrintEnabled) { // Utilise la nouvelle condition
        // IMPORTANT: Passer la réf du QR Code au générateur de PDF
        printReceipt(item, qrCodeRef); 
      } else {
        // Le message d'alerte inclut la condition isNew ou de statut
        const message = item.isNew
          ? "Veuillez d'abord valider la commande (bouton 'Valider') pour désactiver le statut 'Nouveau'."
          : "L'impression n'est possible que pour les commandes 'Payée' ou 'Livrée'.";
        Alert.alert("Impression Désactivée", message);
      }
    };

    return (
      <Animated.View style={[styles.cardContainer, { transform: [{ scale: item.isNew ? scaleAnim : 1 }] }]}>
        <View style={[styles.card, item.isNew && styles.cardNew, { borderLeftColor: STATUS_COLORS[item.status] || COLORS.primary }]}>
          <View style={styles.cardHeader}>
            <View style={styles.headerLeft}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] || COLORS.primary }]}>
                <MaterialCommunityIcons name={getStatusIcon(item.status)} size={16} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.commandeId}>Commande {item.id}</Text>
                {/* CORRECTION: item.order_number est déjà enveloppé */}
                {item.order_number && <Text style={styles.orderNumber}>N°: {item.order_number}</Text>}
              </View>
            </View>

            {item.isNew && (
              <View style={styles.newBadge}>
                <Ionicons name="star" size={14} color={COLORS.white} />
                <Text style={styles.newBadgeText}>Nouveau</Text>
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <MaterialCommunityIcons name="table-furniture" size={18} color={COLORS.primary} />
                {/* CORRECTION: Concaténation de chaînes enveloppée */}
                <Text style={styles.infoLabel}>Table {item.table_number}</Text>
              </View>

              <View style={styles.infoItem}>
                <Ionicons name="cash" size={18} color={COLORS.success} />
                {/* CORRECTION: Concaténation de chaînes enveloppée */}
                <Text style={[styles.infoLabel, { fontWeight: "700", color: COLORS.success }]}>{item.total_amount} Ar</Text>
              </View>
            </View>

            {items.length > 0 && (
              <View style={styles.itemsSection}>
                <Text style={styles.itemsTitle}>📦 Articles ({items.length})</Text>
                {items.slice(0, 3).map((product, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemName} numberOfLines={1}>{product.name}</Text>
                    {/* CORRECTION: Concaténation de chaînes enveloppée */}
                    <Text style={styles.itemQty}>( x {product.qty} )</Text>
                    {/* CORRECTION: Concaténation de chaînes enveloppée */}
                    <Text style={styles.itemPrice}>{(product.price * product.qty).toFixed(0)} Ar</Text>
                  </View>
                ))}
                {/* CORRECTION: Concaténation de chaînes enveloppée */}
                {items.length > 3 && <Text style={styles.moreItems}>+{items.length - 3} articles</Text>}
              </View>
            )}

            <View style={styles.footer}>
              <Ionicons name="calendar" size={14} color={COLORS.gray} />
              <Text style={styles.date}>{new Date(item.created_at).toLocaleString("fr-FR")}</Text>
            </View>

            <View style={styles.actionButtons}>
              {/* Bouton d'impression conditionnel : inactif si isNew est vrai ou si le statut n'est pas Payée/Livrée */}
              <TouchableOpacity 
                onPress={handlePrint} 
                style={[
                  styles.printBtn, 
                  !isPrintEnabled && styles.printBtnInactive // Utilisation de isPrintEnabled
                ]}
                disabled={!isPrintEnabled} // Utilisation de isPrintEnabled
              >
                <Ionicons name="print" size={20} color={isPrintEnabled ? COLORS.white : COLORS.text} />
                <Text style={[styles.printText, !isPrintEnabled && styles.printTextInactive]}>
                  Imprimer le reçu
                </Text>
              </TouchableOpacity>

              {/* Le bouton Valider n'apparaît que si la commande est nouvelle */}
              {item.isNew && (
                <TouchableOpacity onPress={handleValidate} style={styles.validateBtn}>
                  <Text style={styles.validateText}>✅ Valider</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    );
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>📦 Commandes</Text>
          {/* CORRECTION: Concaténation de chaînes enveloppée */}
          <Text style={styles.headerSubtitle}>{filteredCommandes.length} commande(s)</Text>
        </View>

        {commandes.some((c) => c.isNew) && (
          <View style={styles.newBadgeHeader}>
             {/* CORRECTION: Concaténation de chaînes enveloppée */}
            <Text style={styles.newBadgeHeaderText}>{commandes.filter((c) => c.isNew).length} 🆕</Text>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        {["all", "new", "pending"].map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "all" ? "Toutes" : f === "new" ? "Nouvelles" : "En cours"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Chargement...</Text>
        </View>
      ) : filteredCommandes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="inbox-multiple-outline" size={80} color={COLORS.gray} />
          <Text style={styles.emptyText}>Aucune commande</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCommandes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <CommandeCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />}
        />
      )}
      
      {/* COMPOSANT QR CODE MASQUÉ (Hors écran) */}
      <View style={{ position: 'absolute', top: -1000, left: -1000, zIndex: -1 }}>
          <QRCodeSvg
              value={defaultQrCodeValue} 
              size={100}
              quietZone={5}
              color="#000000"
              backgroundColor="#ffffff"
              getRef={qrCodeRef} 
          />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.light },
  headerContainer: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 15 : 15,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: COLORS.white },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  newBadgeHeader: { backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  newBadgeHeaderText: { color: COLORS.white, fontWeight: "700" },
  filterContainer: { flexDirection: "row", paddingHorizontal: 15, paddingVertical: 12, gap: 10, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.gray },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  filterTextActive: { color: COLORS.white },
  listContent: { padding: 12 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { marginTop: 10, color: COLORS.text },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  cardContainer: { marginBottom: 12 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, borderLeftWidth: 5, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardNew: { backgroundColor: "rgba(76, 175, 80, 0.06)" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 15, borderBottomWidth: 1, borderBottomColor: COLORS.gray },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  commandeId: { fontSize: 15, fontWeight: "700", color: COLORS.dark },
  orderNumber: { fontSize: 12, color: COLORS.gray },
  newBadge: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  newBadgeText: { color: COLORS.white, fontWeight: "600", fontSize: 12 },
  cardBody: { padding: 15 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  infoItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,128,128,0.05)", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  infoLabel: { fontSize: 13, color: COLORS.text, fontWeight: "500" },
  itemsSection: { marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.gray, paddingTop: 10 },
  itemsTitle: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: COLORS.light, borderRadius: 6, marginBottom: 4 },
  itemName: { flex: 1, fontSize: 12, fontWeight: "500", color: COLORS.text },
  itemQty: { fontSize: 12, color: COLORS.colorQnt, marginHorizontal: 6 },
  itemPrice: { fontSize: 12, color: COLORS.success, fontWeight: "700" },
  moreItems: { fontSize: 11, color: COLORS.primary, marginTop: 4 },
  footer: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  date: { fontSize: 12, color: COLORS.gray },
  
  // Nouveaux styles pour les boutons d'action
  actionButtons: { flexDirection: 'row', marginTop: 10, gap: 10, alignItems: 'center' },
  validateBtn: { flex: 1, backgroundColor: COLORS.success, paddingVertical: 10, borderRadius: 6, alignItems: "center" },
  validateText: { color: COLORS.white, fontWeight: "700" },
  
  printBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 6,
    gap: 8,
  },
  printBtnInactive: {
    backgroundColor: COLORS.gray,
  },
  printText: {
    color: COLORS.white,
    fontWeight: "700",
  },
  printTextInactive: {
    color: COLORS.text,
  },
});