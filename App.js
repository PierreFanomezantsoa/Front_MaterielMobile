import { StyleSheet } from 'react-native';
import Acceuil from './Composant/Acceuil';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AdminLogin from './Composant/Admin/AdminLogin';
import StatistiquesScreen from './Composant/StatistiquesScreen';
import Toast from 'react-native-toast-message'; // AJOUT

// navigation stack
const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName='admin'
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="accueil" component={Acceuil} />
          <Stack.Screen name="statistiques" component={StatistiquesScreen} />
          <Stack.Screen name="admin" component={AdminLogin} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Toast global */}
      <Toast />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});