import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = "http://192.168.43.58:3000";

const PRIMARY_COLOR = '#008080';
const SECONDARY_COLOR = '#004D40';
const ACCENT_COLOR = '#D32F2F';
const BACKGROUND_LIGHT = '#F0F5F5';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR = '#333';
const BORDER_COLOR = '#E0E0E0';

const { height } = Dimensions.get('window');

export default function AdminAuthScreen({ navigation }) {
  const [mode, setMode] = useState("login"); // login | register
  const [loading, setLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [checking, setChecking] = useState(true); // vérification token
  const [data, setData] = useState({ nom: "", telephone: "", adresse: "", email: "", password: "" });

  const update = (field, value) => setData({ ...data, [field]: value });

  // Vérifie si l'admin est déjà connecté
  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem("admin_token");
        if (token) {
          // Vérifie le token côté serveur
          const res = await fetch(`${API_URL}/admin/verify-token`, {
            method: "GET",
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            navigation.replace("accueil");
            return;
          } else {
            await AsyncStorage.removeItem("admin_token");
          }
        }
      } catch (err) {
        console.log("Erreur vérification token :", err);
      }
      setChecking(false); // on peut afficher le login
    };
    checkToken();
  }, []);

  if (checking) {
    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor: BACKGROUND_LIGHT}}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
      </View>
    );
  }

  // ===== LOGIN =====
  const handleLogin = async () => {
    if (!data.email || !data.password) {
      return Alert.alert("Erreur", "Veuillez remplir tous les champs");
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur login");

      await AsyncStorage.setItem("admin_token", json.token);
      Alert.alert("Succès", "Connexion réussie !");
      navigation.replace("accueil"); // redirection vers écran principal
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== REGISTER =====
  const handleRegister = async () => {
    if (!data.nom || !data.telephone || !data.adresse || !data.email || !data.password) {
      return Alert.alert("Erreur", "Veuillez remplir tous les champs");
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Erreur inscription");

      Alert.alert("Succès", "Inscription réussie !");
      setMode("login");
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.logoSection}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="shield-account" size={60} color={BACKGROUND_LIGHT} />
            </View>
            <Text style={styles.logoText}>Administration</Text>
            <Text style={styles.logoSubtext}>Espace réservé</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.title}>{mode === "login" ? "Connexion" : "Inscription"}</Text>
              <View style={styles.divider} />
              <Text style={styles.subtitle}>
                {mode === "login" ? "Accédez à votre espace" : "Créez votre compte administrateur"}
              </Text>
            </View>

            <View style={styles.formBody}>
              {mode === "register" && (
                <>
                  <InputField icon="person-outline" placeholder="Nom complet" value={data.nom} onChange={t => update("nom", t)} />
                  <InputField icon="call-outline" placeholder="Téléphone" value={data.telephone} onChange={t => update("telephone", t)} keyboardType="phone-pad" />
                  <InputField icon="location-outline" placeholder="Adresse" value={data.adresse} onChange={t => update("adresse", t)} />
                </>
              )}

              <InputField icon="mail-outline" placeholder="Email" value={data.email} onChange={t => update("email", t)} keyboardType="email-address" />

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={22} color={PRIMARY_COLOR} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  placeholderTextColor="#999"
                  secureTextEntry={!isPasswordVisible}
                  value={data.password}
                  onChangeText={t => update("password", t)}
                />
                <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeButton}>
                  <Ionicons name={isPasswordVisible ? "eye-off-outline" : "eye-outline"} size={22} color="#999" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={mode === "login" ? handleLogin : handleRegister} activeOpacity={0.85}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.submitText}>{mode === "login" ? "Se connecter" : "Créer le compte"}</Text>
                    <View style={styles.buttonIconContainer}>
                      <Ionicons name={mode === "login" ? "log-in-outline" : "person-add-outline"} size={22} color="white" />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {mode === "login" ? "Vous n'avez pas de compte ?" : "Vous avez déjà un compte ?"}
                </Text>
                <TouchableOpacity onPress={() => setMode(mode === "login" ? "register" : "login")} activeOpacity={0.7}>
                  <Text style={styles.switchLink}>{mode === "login" ? "S'inscrire" : "Se connecter"}</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>

          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#999" />
            <Text style={styles.footerText}>Connexion sécurisée et cryptée</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// Input personnalisé
function InputField({ icon, placeholder, value, onChange, keyboardType = "default" }) {
  return (
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={22} color={PRIMARY_COLOR} style={styles.icon} />
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#999" value={value} onChangeText={onChange} keyboardType={keyboardType} />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_LIGHT },
  headerBlock: { position:'absolute', top:0,width:'100%',height:height*0.35, backgroundColor:PRIMARY_COLOR, borderBottomLeftRadius:60, borderBottomRightRadius:60, elevation:8, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.25, shadowRadius:10, overflow:'hidden' },
  headerDecoration1:{position:'absolute',top:-50,right:-50,width:200,height:200,borderRadius:100,backgroundColor:'rgba(255,255,255,0.08)'},
  headerDecoration2:{position:'absolute',bottom:-30,left:-30,width:150,height:150,borderRadius:75,backgroundColor:'rgba(255,255,255,0.05)'},
  scrollContent:{ flexGrow:1,paddingTop:height*0.08,paddingHorizontal:20,paddingBottom:30 },
  logoSection:{ alignItems:'center', marginBottom:30 },
  iconCircle:{ width:130,height:130,borderRadius:65,backgroundColor:SECONDARY_COLOR, alignItems:'center', justifyContent:'center', elevation:15, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.3, shadowRadius:12, borderWidth:5,borderColor:'rgba(255,255,255,0.3)', marginBottom:15 },
  logoText:{ color:CARD_BG, fontSize:24, fontWeight:'900', letterSpacing:0.5 },
  logoSubtext:{ color:'rgba(255,255,255,0.9)', fontSize:13, fontWeight:'500', marginTop:4 },
  formCard:{ backgroundColor:CARD_BG,borderRadius:25,elevation:5,shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:0.15,shadowRadius:8,overflow:'hidden' },
  formHeader:{ alignItems:'center',paddingTop:30,paddingHorizontal:25,paddingBottom:20 },
  title:{ fontSize:26,fontWeight:'800',color:SECONDARY_COLOR,marginBottom:10 },
  divider:{ height:3,width:50,backgroundColor:PRIMARY_COLOR,borderRadius:2,marginBottom:12 },
  subtitle:{ fontSize:14,color:'#777',textAlign:'center',lineHeight:20 },
  formBody:{ paddingHorizontal:25,paddingBottom:30 },
  inputContainer:{ flexDirection:'row', alignItems:'center', borderWidth:2,borderColor:BORDER_COLOR,paddingHorizontal:15,paddingVertical:4, borderRadius:15, marginBottom:16, backgroundColor:'#FAFAFA' },
  icon:{ marginRight:12 },
  input:{ flex:1,paddingVertical:14,fontSize:16,color:TEXT_COLOR },
  eyeButton:{ padding:4 },
  submitBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:PRIMARY_COLOR,paddingVertical:18,borderRadius:15, marginTop:10,elevation:5, shadowColor:PRIMARY_COLOR, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8 },
  submitText:{ color:'#FFF', fontSize:17,fontWeight:'800', flex:1, textAlign:'center' },
  buttonIconContainer:{ position:'absolute', right:20, backgroundColor:'rgba(255,255,255,0.2)', borderRadius:20, padding:6 },
  switchContainer:{ flexDirection:'row', justifyContent:'center', alignItems:'center', marginTop:20, paddingTop:20, borderTopWidth:1, borderTopColor:BORDER_COLOR },
  switchText:{ fontSize:14, color:'#666', marginRight:6 },
  switchLink:{ fontSize:15, color:PRIMARY_COLOR, fontWeight:'700', textDecorationLine:'underline' },
  footer:{ flexDirection:'row', alignItems:'center', justifyContent:'center', marginTop:25, gap:8 },
  footerText:{ fontSize:12,color:'#999',fontWeight:'500' },
});