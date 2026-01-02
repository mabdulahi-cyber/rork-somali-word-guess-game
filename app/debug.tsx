import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react-native';

export default function DebugScreen() {
  const router = useRouter();
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({
    apiBaseUrl: null,
    dbEndpoint: null,
    dbNamespace: null,
    dbToken: null,
    apiHealth: null,
  });

  const runTests = async () => {
    const apiBaseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    const dbEndpoint = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
    const dbNamespace = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
    const dbToken = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;

    const results: Record<string, boolean | null> = {
      apiBaseUrl: !!apiBaseUrl,
      dbEndpoint: !!dbEndpoint,
      dbNamespace: !!dbNamespace,
      dbToken: !!dbToken,
      apiHealth: null,
    };

    if (apiBaseUrl) {
      try {
        const response = await fetch(`${apiBaseUrl}/health`);
        results.apiHealth = response.ok;
        console.log('[Debug] Health check response:', response.status);
      } catch (error) {
        results.apiHealth = false;
        console.error('[Debug] Health check failed:', error);
      }
    }

    setTestResults(results);
  };

  const getEnvValue = (key: string): string => {
    let value: string | undefined;
    switch (key) {
      case 'EXPO_PUBLIC_RORK_API_BASE_URL':
        value = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
        break;
      case 'EXPO_PUBLIC_RORK_DB_ENDPOINT':
        value = process.env.EXPO_PUBLIC_RORK_DB_ENDPOINT;
        break;
      case 'EXPO_PUBLIC_RORK_DB_NAMESPACE':
        value = process.env.EXPO_PUBLIC_RORK_DB_NAMESPACE;
        break;
      case 'EXPO_PUBLIC_RORK_DB_TOKEN':
        value = process.env.EXPO_PUBLIC_RORK_DB_TOKEN;
        break;
      default:
        value = undefined;
    }
    if (!value) return 'Not set';
    if (key.includes('TOKEN')) return '***' + value.slice(-4);
    return value;
  };

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#ffd369" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>Debug Information</Text>
          <Text style={styles.subtitle}>Check your configuration</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Environment Variables</Text>
          
          <View style={styles.testRow}>
            <Text style={styles.testLabel}>EXPO_PUBLIC_RORK_API_BASE_URL</Text>
            {testResults.apiBaseUrl === null ? (
              <Text style={styles.testPending}>-</Text>
            ) : testResults.apiBaseUrl ? (
              <CheckCircle size={20} color="#4ecdc4" />
            ) : (
              <XCircle size={20} color="#ff6b6b" />
            )}
          </View>
          <Text style={styles.testValue}>{getEnvValue('EXPO_PUBLIC_RORK_API_BASE_URL')}</Text>

          <View style={styles.testRow}>
            <Text style={styles.testLabel}>EXPO_PUBLIC_RORK_DB_ENDPOINT</Text>
            {testResults.dbEndpoint === null ? (
              <Text style={styles.testPending}>-</Text>
            ) : testResults.dbEndpoint ? (
              <CheckCircle size={20} color="#4ecdc4" />
            ) : (
              <XCircle size={20} color="#ff6b6b" />
            )}
          </View>
          <Text style={styles.testValue}>{getEnvValue('EXPO_PUBLIC_RORK_DB_ENDPOINT')}</Text>

          <View style={styles.testRow}>
            <Text style={styles.testLabel}>EXPO_PUBLIC_RORK_DB_NAMESPACE</Text>
            {testResults.dbNamespace === null ? (
              <Text style={styles.testPending}>-</Text>
            ) : testResults.dbNamespace ? (
              <CheckCircle size={20} color="#4ecdc4" />
            ) : (
              <XCircle size={20} color="#ff6b6b" />
            )}
          </View>
          <Text style={styles.testValue}>{getEnvValue('EXPO_PUBLIC_RORK_DB_NAMESPACE')}</Text>

          <View style={styles.testRow}>
            <Text style={styles.testLabel}>EXPO_PUBLIC_RORK_DB_TOKEN</Text>
            {testResults.dbToken === null ? (
              <Text style={styles.testPending}>-</Text>
            ) : testResults.dbToken ? (
              <CheckCircle size={20} color="#4ecdc4" />
            ) : (
              <XCircle size={20} color="#ff6b6b" />
            )}
          </View>
          <Text style={styles.testValue}>{getEnvValue('EXPO_PUBLIC_RORK_DB_TOKEN')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>API Health Check</Text>
          
          <View style={styles.testRow}>
            <Text style={styles.testLabel}>API Health Endpoint</Text>
            {testResults.apiHealth === null ? (
              <Text style={styles.testPending}>Not tested</Text>
            ) : testResults.apiHealth ? (
              <CheckCircle size={20} color="#4ecdc4" />
            ) : (
              <XCircle size={20} color="#ff6b6b" />
            )}
          </View>
        </View>

        <Pressable
          onPress={runTests}
          style={({ pressed }) => [
            styles.testButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.testButtonText}>Run Tests</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Common Issues</Text>
          <Text style={styles.helpText}>
            1. Make sure EXPO_PUBLIC_RORK_API_BASE_URL is set correctly{'\n'}
            2. Backend must be deployed and running{'\n'}
            3. Database credentials must be valid{'\n'}
            4. Check console logs for detailed errors
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffd369',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#c0c4d6',
  },
  card: {
    backgroundColor: 'rgba(15, 30, 60, 0.85)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 105, 0.15)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffd369',
    marginBottom: 16,
  },
  testRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testLabel: {
    fontSize: 14,
    color: '#ffffff',
    flex: 1,
  },
  testValue: {
    fontSize: 12,
    color: '#c0c4d6',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  testPending: {
    fontSize: 14,
    color: '#888',
  },
  testButton: {
    backgroundColor: '#ffd369',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  testButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16213e',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  helpText: {
    fontSize: 14,
    color: '#c0c4d6',
    lineHeight: 22,
  },
});
