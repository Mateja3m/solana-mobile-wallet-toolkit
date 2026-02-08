import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import React, { useCallback, useMemo, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createMwaProvider, createToolkit } from 'smwt-core';

global.Buffer = global.Buffer || Buffer;

const MESSAGE = 'SMWT PoC signing demo';
const MAX_SIGNATURE_PREVIEW = 24;

function shortenMiddle(value, sideLength = MAX_SIGNATURE_PREVIEW) {
  if (!value || value.length <= sideLength * 2 + 3) {
    return value;
  }

  const start = value.slice(0, sideLength);
  const end = value.slice(-sideLength);
  return `${start}...${end}`;
}

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
        name: 'SMWT Demo App',
        icon: 'splash.png'
      },
      chain: 'solana:devnet',
      logger: {
        info: (message) => addLog(message),
        warn: (message) => addLog(message),
        error: (message) => addLog(message)
      }
    });

    return createToolkit({
      provider,
      logger: {
        info: (message) => addLog(message),
        warn: (message) => addLog(message),
        error: (message) => addLog(message)
      }
    });
  }, [addLog]);

  const onConnect = async () => {
    setIsBusy(true);
    try {
      addLog('Connect button pressed.');
      const nextSession = await toolkit.connect();
      setSession(nextSession);
      setSignatureBase64(null);
      addLog(`Connected: ${nextSession.publicKey}`);
    } catch (error) {
      addLog(`Connect error: ${error.code || 'UNKNOWN'} - ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const onSign = async () => {
    setIsBusy(true);
    try {
      addLog('Sign Message button pressed.');
      const messageBytes = Buffer.from(MESSAGE, 'utf8');
      const signature = await toolkit.signMessage(messageBytes);
      const base64 = Buffer.from(signature).toString('base64');
      setSignatureBase64(base64);
      addLog('Message signed successfully.');
    } catch (error) {
      addLog(`Sign error: ${error.code || 'UNKNOWN'} - ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const onDisconnect = async () => {
    setIsBusy(true);
    try {
      addLog('Disconnect button pressed.');
      await toolkit.disconnect();
      setSession(null);
      setSignatureBase64(null);
      addLog('Disconnected.');
    } catch (error) {
      addLog(`Disconnect error: ${error.code || 'UNKNOWN'} - ${error.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const onCopySignature = () => {
    if (!signatureBase64) {
      return;
    }

    Clipboard.setString(signatureBase64);
    addLog('Signature copied to clipboard.');
  };

  const canConnect = !isBusy && !session;
  const canSign = !isBusy && !!session;
  const canDisconnect = !isBusy && !!session;
  const signaturePreview = shortenMiddle(signatureBase64);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>SMWT - Demo App</Text>
        <Text style={styles.subtitle}>React Native wallet connection + signing demo</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Status</Text>
          <Text style={styles.statusText}>
            {session ? `Connected: ${session.publicKey}` : 'Disconnected'}
          </Text>
        </View>

        {signatureBase64 ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusLabel}>Signature (base64)</Text>
            <Text style={styles.statusText}>{signaturePreview}</Text>
            <View style={styles.copyButton}>
              <Button title="Copy Signature" onPress={onCopySignature} />
            </View>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <Button title="Connect" onPress={onConnect} disabled={!canConnect} />
        </View>
        <View style={styles.buttonRow}>
          <Button title="Sign Message" onPress={onSign} disabled={!canSign} />
        </View>
        <View style={styles.buttonRow}>
          <Button title="Disconnect" onPress={onDisconnect} disabled={!canDisconnect} />
        </View>

        <View style={styles.logBox}>
          <Text style={styles.statusLabel}>Logs</Text>
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
  subtitle: {
    color: '#555'
  },
  statusBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  statusLabel: {
    fontWeight: '600',
    marginBottom: 4
  },
  statusText: {
    color: '#333'
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
