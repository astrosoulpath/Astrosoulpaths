import { useAuthStore } from "@/features/auth/store/auth.store";
import { apiClient } from "@/lib/api/axios";
import axios from "axios";
import { Link } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// TODO: Remove before production release.

const FALLBACK_RECONCILE_API_BASE_URL = "https://backend-99k3.onrender.com";

type ReconcileResponseBody = Record<string, unknown> | null;

type ErrorState = {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
};

function getReconcileApiBaseUrl() {
  const configuredBaseUrl =
    process.env.EXPO_PUBLIC_RECONCILE_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const sharedApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (sharedApiBaseUrl) {
    return sharedApiBaseUrl;
  }

  return FALLBACK_RECONCILE_API_BASE_URL;
}

function formatJson(value: unknown) {
  if (value == null) {
    return "-";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readValue(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

export default function ReconcileTestScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme !== "light";
  const sessionToken = useAuthStore(
    (state) => state.session?.accessToken ?? null,
  );

  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<ReconcileResponseBody>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  const apiBaseUrl = useMemo(() => getReconcileApiBaseUrl(), []);
  const [isPressed, setIsPressed] = useState(false);

  const colors = {
    background: isDark ? "#0b1120" : "#f8fafc",
    card: isDark ? "#111827" : "#ffffff",
    border: isDark ? "#243041" : "#d7e0ea",
    text: isDark ? "#e5eefb" : "#0f172a",
    secondaryText: isDark ? "#9fb1c7" : "#526072",
    inputBackground: isDark ? "#0f172a" : "#f8fafc",
    accent: "#2563eb",
    danger: "#dc2626",
    success: "#059669",
    muted: isDark ? "#152033" : "#eef2f7",
  };

  async function handleReconcile() {
    const trimmedOrderId = orderId.trim();

    setResponseStatus(null);
    setResponseBody(null);
    setReason(null);
    setErrorState(null);

    if (!trimmedOrderId) {
      setErrorState({
        message:
          "Please enter a Razorpay order id before testing reconciliation.",
      });
      return;
    }

    if (!sessionToken) {
      setErrorState({
        message:
          "No auth token found. Log in first before calling reconciliation.",
        status: 401,
      });
      return;
    }

    setIsLoading(true);
    console.log("[ReconcileTest] request started", {
      orderId: trimmedOrderId,
      apiBaseUrl,
      hasToken: Boolean(sessionToken),
    });

    try {
      const response = await apiClient.post<ReconcileResponseBody>(
        `/payments/reconcile/${encodeURIComponent(trimmedOrderId)}`,
        undefined,
        {
          baseURL: apiBaseUrl,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      const nextReason = readValue(response.data, [
        "reason",
        "message",
        "detail",
      ]);

      setResponseStatus(response.status);
      setResponseBody(response.data);
      setReason(nextReason);

      console.log("[ReconcileTest] success", {
        orderId: trimmedOrderId,
        status: response.status,
        data: response.data,
      });
    } catch (error) {
      const axiosError = axios.isAxiosError(error) ? error : null;
      const backendData = (axiosError?.response?.data ?? null) as Record<
        string,
        unknown
      > | null;

      const nextError: ErrorState = {
        message:
          typeof backendData?.message === "string"
            ? backendData.message
            : axiosError?.response?.status === 401
              ? "Unauthorized. Your session may be expired."
              : (axiosError?.message ?? "Unable to reconcile payment."),
        code: axiosError?.code,
        status: axiosError?.response?.status,
        details: backendData,
      };

      setResponseStatus(axiosError?.response?.status ?? null);
      setResponseBody(backendData);
      setReason(readValue(backendData, ["reason", "error", "message"]));
      setErrorState(nextError);

      console.log("[ReconcileTest] failed", {
        orderId: trimmedOrderId,
        status: axiosError?.response?.status,
        code: axiosError?.code,
        message: nextError.message,
        data: backendData,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setOrderId("");
    setResponseStatus(null);
    setResponseBody(null);
    setReason(null);
    setErrorState(null);
  }

  const derivedStatus = readValue(responseBody, [
    "status",
    "paymentStatus",
    "state",
  ]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            DEV TOOL
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Reconciliation Test
          </Text>
          <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
            Manual payment reconciliation test screen for Razorpay order ids.
          </Text>

          {!__DEV__ ? (
            <View
              style={[
                styles.noticeBox,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.noticeText, { color: colors.text }]}>
                This route is intended for development builds only.
              </Text>
            </View>
          ) : null}

          <View style={styles.metaSection}>
            <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>
              API Base URL
            </Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {apiBaseUrl}
            </Text>
          </View>

          <View style={styles.metaSection}>
            <Text style={[styles.metaLabel, { color: colors.secondaryText }]}>
              Auth Token
            </Text>
            <Text
              style={[
                styles.metaValue,
                { color: sessionToken ? colors.success : colors.danger },
              ]}
            >
              {sessionToken
                ? "Available in auth store"
                : "Missing from auth store"}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            Razorpay Order ID
          </Text>
          <TextInput
            value={orderId}
            onChangeText={setOrderId}
            placeholder="order_ABC123"
            placeholderTextColor={colors.secondaryText}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              },
            ]}
          />

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleReconcile}
              onPressIn={() => setIsPressed(true)}
              onPressOut={() => setIsPressed(false)}
              disabled={isLoading}
              style={[
                styles.button,
                styles.primaryButton,
                {
                  backgroundColor: isLoading ? "#93c5fd" : colors.accent,
                  borderColor: isLoading ? "#93c5fd" : colors.accent,
                  opacity: isPressed && !isLoading ? 0.9 : 1,
                },
              ]}
            >
              {isLoading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.buttonText}>Reconciling...</Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>Reconcile Payment</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleReset}
              style={[
                styles.button,
                styles.secondaryButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.text }]}
              >
                Clear
              </Text>
            </Pressable>
          </View>

          <Text style={[styles.helperText, { color: colors.secondaryText }]}>
            Enter an order id, then tap Reconcile Payment to manually hit the
            backend endpoint.
          </Text>

          <Link href="/" style={[styles.backLink, { color: colors.accent }]}>
            Back to index
          </Link>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Response
          </Text>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.secondaryText }]}>
              HTTP Status
            </Text>
            <Text style={[styles.resultValue, { color: colors.text }]}>
              {responseStatus ?? "-"}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.secondaryText }]}>
              Status
            </Text>
            <Text style={[styles.resultValue, { color: colors.text }]}>
              {derivedStatus ?? "-"}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.secondaryText }]}>
              Reason
            </Text>
            <Text style={[styles.resultValue, { color: colors.text }]}>
              {reason ?? "-"}
            </Text>
          </View>

          <View style={styles.resultBlock}>
            <Text style={[styles.resultLabel, { color: colors.secondaryText }]}>
              Errors
            </Text>
            <Text
              style={[
                styles.jsonText,
                { color: errorState ? colors.danger : colors.secondaryText },
              ]}
            >
              {errorState ? formatJson(errorState) : "-"}
            </Text>
          </View>

          <View style={styles.resultBlock}>
            <Text style={[styles.resultLabel, { color: colors.secondaryText }]}>
              API Response
            </Text>
            <Text style={[styles.jsonText, { color: colors.text }]}>
              {formatJson(responseBody)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  metaSection: {
    marginTop: 16,
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButton: {
    minWidth: 88,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  backLink: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  helperText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  resultRow: {
    marginBottom: 12,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 15,
    lineHeight: 21,
  },
  resultBlock: {
    marginTop: 8,
  },
  jsonText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "monospace",
  },
  noticeBox: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
