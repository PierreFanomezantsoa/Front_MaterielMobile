import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const screenWidth = Dimensions.get('window').width;
const API_URL = 'http://192.168.43.58:3000/api/materiel';

const PRIMARY_COLOR = '#008080';
const BACKGROUND_LIGHT = '#F0F5F5';
const CARD_BG = '#FFFFFF';
const TEXT_COLOR = '#333';

const StatistiquesScreen = ({ route, navigation }) => {
  const [chartData, setChartData] = useState([]);
  const [totalQuantite, setTotalQuantite] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Priorité : utiliser les données passées par navigation (plus rapide)
    // Sinon : faire l'appel API
    if (route.params?.data) {
      processData(route.params.data);
    } else {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(API_URL);
      // CORRECTION ICI : NestJS renvoie { data: [...] }
      const materiels = res.data.data || []; 
      processData(materiels);
    } catch (error) {
      console.error("Erreur Fetch:", error);
      setLoading(false);
    }
  };

  const processData = (materiels) => {
  if (!Array.isArray(materiels)) {
    setChartData([]);
    setLoading(false);
    return;
  }

  // Quantité en bon état
  const bon = materiels.reduce((sum, item) => {
    if (item.etat?.toLowerCase() === 'bon') {
      return sum + (Number(item.quantite) || 0);
    }
    return sum;
  }, 0);

  // Quantité en mauvais état
  const mauvais = materiels.reduce((sum, item) => {
    if (item.etat?.toLowerCase() === 'mauvais') {
      return sum + (Number(item.quantite) || 0);
    }
    return sum;
  }, 0);

  // Quantité abîmée
  const abime = materiels.reduce((sum, item) => {
    if (['abimé', 'abime'].includes(item.etat?.toLowerCase())) {
      return sum + (Number(item.quantite) || 0);
    }
    return sum;
  }, 0);

  // Quantité totale réelle
  const totalQty = materiels.reduce(
    (sum, item) => sum + (Number(item.quantite) || 0),
    0
  );

  setTotalQuantite(totalQty);

  const formattedData = [
    {
      name: 'Bon',
      population: bon,
      color: '#4CAF50',
      legendFontColor: '#333',
      legendFontSize: 14,
    },
    {
      name: 'Mauvais',
      population: mauvais,
      color: '#F44336',
      legendFontColor: '#333',
      legendFontSize: 14,
    },
    {
      name: 'Abîmé',
      population: abime,
      color: '#FF9800',
      legendFontColor: '#333',
      legendFontSize: 14,
    },
  ];

  setChartData(formattedData);
  setLoading(false);
};

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        <Text style={styles.loadingText}>Chargement des statistiques...</Text>
      </View>
    );
  }

  const hasData = chartData.some(d => d.population > 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerDecoration} />
        <Text style={styles.headerTitle}>Statistiques</Text>
        <Text style={styles.headerSubtitle}>État du matériel & inventaire</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!hasData ? (
          <View style={styles.emptyView}>
            <Ionicons name="bar-chart" size={80} color="#ccc" />
            <Text style={styles.noDataText}>Aucune donnée disponible</Text>
          </View>
        ) : (
          <>
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Répartition par état (Unités)</Text>
              <PieChart
                data={chartData}
                width={screenWidth - 40}
                height={220}
                chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </View>

            <View style={styles.statsGrid}>
              {chartData.map((item, index) => {
                const totalItems = chartData.reduce((acc, curr) => acc + curr.population, 0);
                const percentage = totalItems > 0 ? ((item.population / totalItems) * 100).toFixed(1) : 0;
                const iconName = item.name === 'Bon' ? 'checkmark-circle' : item.name === 'Mauvais' ? 'close-circle' : 'warning';
                
                return (
                  <View key={index} style={[styles.statCard, { borderTopColor: item.color }]}>
                    <View style={styles.statCardHeader}>
                      <Ionicons name={iconName} size={18} color={item.color} />
                      <Text style={[styles.statCardTitle, {color: item.color}]}>{item.name}</Text>
                    </View>
                    <Text style={styles.statCardValue}>{item.population}</Text>
                    <Text style={styles.statCardPercentage}>{percentage}%</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Quantité Totale en Stock</Text>
                  <Text style={styles.summaryValue}>{totalQuantite}</Text>
                </View>
                <Ionicons name="cube-outline" size={40} color={PRIMARY_COLOR} />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backButtonBottom} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color="white" />
          <Text style={styles.backButtonText}>Retour à l'inventaire</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_LIGHT },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, color: PRIMARY_COLOR, fontWeight: '500' },
  header: { backgroundColor: PRIMARY_COLOR, paddingTop: 50, paddingBottom: 30, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 8 },
  headerDecoration: { position: 'absolute', top: -60, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)' },
  headerTitle: { color: 'white', fontSize: 26, fontWeight: '900' },
  headerSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  chartContainer: { backgroundColor: CARD_BG, borderRadius: 20, padding: 16, marginBottom: 16, elevation: 4, alignItems: 'center' },
  chartTitle: { fontSize: 16, fontWeight: '700', color: TEXT_COLOR, marginBottom: 10 },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: CARD_BG, borderRadius: 15, padding: 12, elevation: 3, borderTopWidth: 4 },
  statCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  statCardTitle: { fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  statCardValue: { fontSize: 22, fontWeight: '900', color: TEXT_COLOR },
  statCardPercentage: { fontSize: 11, color: '#999' },
  summaryCard: { backgroundColor: CARD_BG, borderRadius: 20, padding: 20, elevation: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#666', fontWeight: '600' },
  summaryValue: { fontSize: 30, fontWeight: '900', color: PRIMARY_COLOR },
  emptyView: { alignItems: 'center', marginTop: 50 },
  noDataText: { fontSize: 18, color: '#999', marginTop: 10 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 15, borderTopWidth: 1, borderTopColor: '#eee' },
  backButtonBottom: { backgroundColor: PRIMARY_COLOR, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12 },
  backButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 5 }
});

export default StatistiquesScreen;