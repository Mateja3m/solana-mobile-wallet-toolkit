import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import React, { useCallback, useMemo, useState } from 'react';
import Clipboard from '@react-native-clipboard/clipboard';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createMwaProvider, createToolkit, ErrorCode } from 'smwt-core';
import { createLogger } from './logger';

global.Buffer = global.Buffer || Buffer;

const MESSAGE = 'SMWT PoC signing test';

function mapErrorToUserFeedback(error) {
  const code = error?.code || ErrorCode.UNKNOWN;

  switch (code) {
    case ErrorCode.USER_DECLINED_APPROVAL:
      return {
        reason: 'Signing request was declined in the wallet.',
        guidance: 'Approve the wallet request to complete signing.'
      };
    case ErrorCode.WALLET_NOT_INSTALLED:
      return {
        reason: 'No compatible Solana wallet was detected on this device.',
        guidance: 'Install Phantom and retry the flow.'
      };
    case ErrorCode.TIMEOUT:
      return {
        reason: 'Wallet request timed out.',
        guidance: 'Retry and keep both apps active during the handoff.'
      };
    case ErrorCode.AUTHORIZATION_FAILED:
    case ErrorCode.AUTH_TOKEN_INVALID:
      return {
        reason: 'Wallet session is no longer valid.',
        guidance: 'Reconnect the wallet, then sign again.'
      };
    case ErrorCode.FLOW_ABORTED:
    case ErrorCode.DEEPLINK_RETURN_FAILED:
      return {
        reason: 'Wallet did not return control to the app cleanly.',
        guidance: 'Switch back to SMWT manually and retry signing.'
      };
    default:
      return {
        reason: 'Unexpected wallet error occurred.',
        guidance: 'Retry once. If it fails again, reconnect the wallet.'
      };
  }
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

  const logger = useMemo(() => createLogger(addLog), [addLog]);

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

  const handleError = useCallback((error, actionLabel) => {
    const code = error?.code || ErrorCode.UNKNOWN;
    const feedback = mapErrorToUserFeedback(error);
    logger.error(`${actionLabel} failed (${code}): ${feedback.reason}`);
    logger.warn(feedback.guidance);

    if (logger.debugEnabled) {
      logger.debug('Raw error details', {
        action: actionLabel,
        code,
        message: error?.message,
        stack: error?.stack
      });
    }
  }, [logger]);

  const onConnect = async () => {
    setIsBusy(true);
    try {
      const nextSession = await toolkit.connect();
      setSession(nextSession);
      setSignatureBase64(null);
      logger.info('Connected');
    } catch (error) {
      handleError(error, 'Connect');
    } finally {
      setIsBusy(false);
    }
  };

  const onSign = async () => {
    setIsBusy(true);
    try {
      logger.info('Signing requested');
      const messageBytes = Buffer.from(MESSAGE, 'utf8');
      const signature = await toolkit.signMessage(messageBytes);
      setSignatureBase64(Buffer.from(signature).toString('base64'));
      logger.info('Signature received');
    } catch (error) {
      handleError(error, 'Sign message');
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
      logger.info('Disconnected');
    } catch (error) {
      handleError(error, 'Disconnect');
    } finally {
      setIsBusy(false);
    }
  };

  const onCopySignature = () => {
    if (!signatureBase64) return;
    Clipboard.setString(signatureBase64);
    logger.info('Signature copied');
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
