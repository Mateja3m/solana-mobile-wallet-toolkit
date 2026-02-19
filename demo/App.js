import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import React, { useCallback, useMemo, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createMwaProvider, createToolkit } from 'smwt-core';

global.Buffer = global.Buffer || Buffer;

const MESSAGE = 'SMWT PoC signing test';

export default function App() {
  const [session, setSession] = useState(null);
  const [logs, setLogs] = useState([]);
  const [signatureBase64, setSignatureBase64] = useState(null);
  const [isBusy, setIsBusy] = useState(false);

  const addLog = useCallback((message) => {
    const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
    setLogs((prev) => [`${timestamp} ${message}`, ...prev]);
  }, []);

  const toolkit = useMemo(() => {
    const provider = createMwaProvider({
      appIdentity: {
        name: 'SMWT Demo',
        uri: 'https://github.com/Mateja3m/solana-mobile-wallet-toolkit'
      },
      chain: 'solana:devnet'
    });

    return createToolkit({ provider });
  }, []);

  const onConnect = async () => {
    setIsBusy(true);
    try {
      const nextSession = await toolkit.connect();
      setSession(nextSession);
      setSignatureBase64(null);
      addLog('Connected');
    } catch (error) {
      addLog(`Error (${error.code || 'UNKNOWN'}): ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const onSign = async () => {
    setIsBusy(true);
    try {
      addLog('Signing requested');
      const messageBytes = Buffer.from(MESSAGE, 'utf8');
      const signature = await toolkit.signMessage(messageBytes);
      setSignatureBase64(Buffer.from(signature).toString('base64'));
      addLog('Signature received');
    } catch (error) {
      addLog(`Error (${error.code || 'UNKNOWN'}): ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const onDisconnect = async () => {
    setIsBusy(true);
    try {
      await toolkit.disconnect();
      setSession(null);
      setSignatureBase64(null);
      addLog('Disconnected');
    } catch (error) {
      addLog(`Error (${error.code || 'UNKNOWN'}): ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const onCopySignature = () => {
    if (!signatureBase64) return;
    Clipboard.setString(signatureBase64);
    addLog('Signature copied');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>SMWT PoC Demo</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>{session ? `Connected: ${session.publicKey}` : 'Disconnected'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Signature (base64)</Text>
          <Text style={styles.signature} selectable>
            {signatureBase64 || 'No signature yet'}
          </Text>
          <View style={styles.copyButton}>
            <Button title="COPY" onPress={onCopySignature} disabled={!signatureBase64 || isBusy} />
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Button title="CONNECT" onPress={onConnect} disabled={isBusy || !!session} />
        </View>
        <View style={styles.buttonRow}>
          <Button title="SIGN MESSAGE" onPress={onSign} disabled={isBusy || !session} />
        </View>
        <View style={styles.buttonRow}>
          <Button title="DISCONNECT" onPress={onDisconnect} disabled={isBusy || !session} />
        </View>

        <View style={styles.logBox}>
          <Text style={styles.label}>Logs</Text>
          <ScrollView style={styles.logScroll}>
            {logs.map((line, index) => (
              <Text style={styles.logLine} key={index}>
                {line}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F6F6'
  },
  container: {
    flex: 1,
    padding: 20,
    gap: 12
  },
  title: {
    fontSize: 24,
    fontWeight: '600'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  label: {
    fontWeight: '600',
    marginBottom: 4
  },
  value: {
    color: '#333'
  },
  signature: {
    color: '#333',
    fontSize: 12
  },
  buttonRow: {
    marginTop: 4
  },
  copyButton: {
    marginTop: 10
  },
  logBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  logScroll: {
    marginTop: 6
  },
  logLine: {
    fontSize: 12,
    marginBottom: 4,
    color: '#444'
  }
});
