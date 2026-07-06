import { ApiError, apiClient } from "@/lib/api/axios";
import { isAxiosError } from "axios";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import RazorpayCheckout from "react-native-razorpay";

const CREATE_ORDER_URL =
  "https://backend-99k3.onrender.com/payments/create-order";

const RAZORPAY_TEST_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID?.trim();
const DEFAULT_CURRENCY = "INR";

type BackendOrderPayload = {
  id?: string;
  orderId?: string;
  order_id?: string;
  amount?: number | string;
  currency?: string;
  key?: string;
  keyId?: string;
  razorpayKey?: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  [key: string]: unknown;
};

type CreateOrderApiResponse = {
  success?: boolean;
  message?: string;
  data?: BackendOrderPayload;
  order?: BackendOrderPayload;
  result?: BackendOrderPayload;
  id?: string;
  orderId?: string;
  order_id?: string;
  amount?: number | string;
  currency?: string;
  key?: string;
  keyId?: string;
  razorpayKey?: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  [key: string]: unknown;
};

type NormalizedOrder = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  notes?: Record<string, string>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  raw: CreateOrderApiResponse;
};

type RazorpaySuccessData = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureData = {
  code?: number | string;
  description?: string;
  error?: {
    code?: number | string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, string>;
  };
};

type RazorpayCheckoutOptions = {
  description: string;
  image?: string;
  currency: string;
  key: string;
  amount: number;
  name: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
};

function extractOrderCandidate(response: CreateOrderApiResponse) {
  return response.data || response.order || response.result || response;
}

function normalizeAmount(value: number | string | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : NaN;
  }

  return NaN;
}

function normalizeOrderResponse(
  response: CreateOrderApiResponse,
): NormalizedOrder {
  const candidate = extractOrderCandidate(response);
  const orderId = candidate.order_id || candidate.orderId || candidate.id;
  const amount = normalizeAmount(candidate.amount ?? response.amount);
  const currency = candidate.currency || response.currency || DEFAULT_CURRENCY;
  const keyId =
    candidate.key ||
    candidate.keyId ||
    candidate.razorpayKey ||
    response.key ||
    response.keyId ||
    response.razorpayKey ||
    RAZORPAY_TEST_KEY_ID ||
    "";

  if (!orderId) {
    throw new Error("Backend did not return a valid Razorpay order id.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Backend returned an invalid order amount.");
  }

  if (!keyId) {
    throw new Error(
      "Missing Razorpay test key. Set EXPO_PUBLIC_RAZORPAY_KEY_ID or return key from backend.",
    );
  }

  return {
    orderId,
    amount,
    currency,
    keyId,
    notes: candidate.notes || response.notes,
    prefill: candidate.prefill || response.prefill,
    theme: candidate.theme || response.theme,
    raw: response,
  };
}

function formatAmountPreview(value: string) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "--";
  }

  return parsedValue.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (isAxiosError(error)) {
    const backendMessage = error.response?.data;

    if (typeof backendMessage === "string" && backendMessage.trim()) {
      return backendMessage.trim();
    }

    if (
      backendMessage &&
      typeof backendMessage === "object" &&
      "message" in backendMessage &&
      typeof backendMessage.message === "string"
    ) {
      return backendMessage.message;
    }

    return error.message || "Recharge request failed.";
  }

  return "Something went wrong while creating the order.";
}

function formatRazorpayFailure(error: RazorpayFailureData) {
  const nestedDescription = error.error?.description?.trim();
  const directDescription = error.description?.trim();

  if (nestedDescription) {
    return nestedDescription;
  }

  if (directDescription) {
    return directDescription;
  }

  return "Payment failed or was cancelled. Please try again.";
}

export default function RechargeScreen() {
  const [amount, setAmount] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [orderResponse, setOrderResponse] =
    React.useState<CreateOrderApiResponse | null>(null);

  const numericAmount = Number(amount);
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const isBusy = isSubmitting || isProcessingPayment;

  const handleAmountChange = React.useCallback((value: string) => {
    const sanitizedValue = value.replace(/[^0-9.]/g, "");
    setAmount(sanitizedValue);
    setErrorMessage(null);
    setStatusMessage(null);
  }, []);

  const handleRecharge = async () => {
    if (!isAmountValid) {
      setErrorMessage("Enter a valid recharge amount.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setOrderResponse(null);

    try {
      const response = await apiClient.post<CreateOrderApiResponse>(
        CREATE_ORDER_URL,
        {
          amount: numericAmount,
        },
      );
      console.log("[Recharge] order response", response.data);

      const order = normalizeOrderResponse(response.data);
      setOrderResponse(response.data);
      setIsSubmitting(false);
      setIsProcessingPayment(true);

      const checkoutOptions: RazorpayCheckoutOptions = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Astro Wallet",
        description: `Wallet recharge of INR ${formatAmountPreview(amount)}`,
        notes: order.notes,
        prefill: order.prefill,
        theme: {
          color: order.theme?.color || "#D9A441",
        },
        modal: {
          ondismiss: () => {
            console.log("[Recharge] payment failure", {
              description: "Checkout dismissed by user",
            });
          },
        },
      };

      const paymentData = (await RazorpayCheckout.open(
        checkoutOptions,
      )) as RazorpaySuccessData;

      console.log("[Recharge] payment success", paymentData);
      setStatusMessage("Payment processing, waiting for verification");
      Alert.alert(
        "Payment received",
        "Payment processing, waiting for verification",
      );

      return;
    } catch (error) {
      if (isAxiosError(error) || error instanceof Error) {
        if (isAxiosError(error)) {
          setOrderResponse(null);
          setErrorMessage(formatErrorMessage(error));
        } else {
          const checkoutError = error as RazorpayFailureData & Error;
          const failureMessage = formatRazorpayFailure(checkoutError);

          console.log("[Recharge] payment failure", checkoutError);
          setStatusMessage(null);
          setErrorMessage(failureMessage);
          Alert.alert("Payment failed", failureMessage);
        }
      } else {
        const fallbackMessage =
          "Unable to start recharge flow. Please try again.";
        console.log("[Recharge] payment failure", error);
        setStatusMessage(null);
        setErrorMessage(fallbackMessage);
        Alert.alert("Payment failed", fallbackMessage);
      }
    } finally {
      setIsSubmitting(false);
      setIsProcessingPayment(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070b28" }}>
      <StatusBar barStyle="light-content" backgroundColor="#070b28" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={["#101a59", "#0b123e", "#080d2d"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: "rgba(244,197,109,0.2)",
              padding: 22,
              justifyContent: "space-between",
              minHeight: 520,
            }}
          >
            <View>
              <Text
                style={{
                  color: "#F4C56D",
                  fontSize: 12,
                  fontWeight: "700",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Wallet Recharge
              </Text>

              <Text
                style={{
                  color: "#F8F8FF",
                  fontSize: 30,
                  fontWeight: "800",
                  marginTop: 10,
                }}
              >
                Create Recharge Order
              </Text>

              <Text
                style={{
                  color: "rgba(225,229,255,0.68)",
                  fontSize: 14,
                  lineHeight: 22,
                  marginTop: 10,
                }}
              >
                Create a Razorpay test-mode order, open checkout, and wait for
                backend verification before crediting the wallet.
              </Text>

              <View
                style={{
                  marginTop: 18,
                  alignSelf: "flex-start",
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(244,197,109,0.18)",
                  backgroundColor: "rgba(244,197,109,0.08)",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                }}
              >
                <Text
                  style={{
                    color: "#F4C56D",
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Razorpay Test Mode
                </Text>
              </View>

              <View style={{ marginTop: 32 }}>
                <Text
                  style={{
                    color: "#DDE3FF",
                    fontSize: 14,
                    fontWeight: "700",
                    marginBottom: 10,
                  }}
                >
                  Amount
                </Text>

                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "rgba(244,197,109,0.2)",
                    backgroundColor: "rgba(5,10,36,0.75)",
                    paddingHorizontal: 16,
                    paddingVertical: 4,
                  }}
                >
                  <TextInput
                    placeholder="Enter amount"
                    placeholderTextColor="rgba(221,227,255,0.35)"
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    editable={!isBusy}
                    style={{
                      color: "#FFFFFF",
                      fontSize: 18,
                      fontWeight: "600",
                      paddingVertical: 16,
                    }}
                  />
                </View>

                <Text
                  style={{
                    color: "rgba(221,227,255,0.56)",
                    fontSize: 12,
                    marginTop: 10,
                  }}
                >
                  Recharge preview: INR {formatAmountPreview(amount)}
                </Text>

                {errorMessage ? (
                  <Text
                    style={{
                      color: "#FF9A9A",
                      fontSize: 13,
                      marginTop: 12,
                    }}
                  >
                    {errorMessage}
                  </Text>
                ) : null}

                {statusMessage ? (
                  <Text
                    style={{
                      color: "#A7F3D0",
                      fontSize: 13,
                      marginTop: 12,
                    }}
                  >
                    {statusMessage}
                  </Text>
                ) : null}
              </View>
            </View>

            <View>
              <Pressable
                onPress={handleRecharge}
                disabled={isBusy}
                style={({ pressed }) => ({
                  borderRadius: 18,
                  overflow: "hidden",
                  opacity: isBusy ? 0.7 : pressed ? 0.9 : 1,
                })}
              >
                <LinearGradient
                  colors={["#F4C56D", "#D9A441"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    minHeight: 58,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  {isBusy ? <ActivityIndicator color="#1B1D3A" /> : null}
                  <Text
                    style={{
                      color: "#1B1D3A",
                      fontSize: 16,
                      fontWeight: "800",
                    }}
                  >
                    {isSubmitting
                      ? "Creating Order..."
                      : isProcessingPayment
                        ? "Opening Checkout..."
                        : "Recharge Wallet"}
                  </Text>
                </LinearGradient>
              </Pressable>

              <View
                style={{
                  marginTop: 22,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.08)",
                  padding: 16,
                }}
              >
                <Text
                  style={{
                    color: "#F4C56D",
                    fontSize: 13,
                    fontWeight: "700",
                    marginBottom: 8,
                  }}
                >
                  API Route
                </Text>
                <Text
                  style={{
                    color: "#DDE3FF",
                    fontSize: 12,
                    lineHeight: 18,
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  }}
                >
                  POST {CREATE_ORDER_URL}
                  {"\n"}
                  Uses backend-generated order_id for checkout.
                </Text>
              </View>

              {orderResponse ? (
                <View
                  style={{
                    marginTop: 18,
                    borderRadius: 18,
                    backgroundColor: "rgba(90,165,120,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(110,231,183,0.24)",
                    padding: 16,
                  }}
                >
                  <Text
                    style={{
                      color: "#A7F3D0",
                      fontSize: 13,
                      fontWeight: "700",
                      marginBottom: 10,
                    }}
                  >
                    Latest Order Response
                  </Text>

                  <Text
                    style={{
                      color: "#ECFDF5",
                      fontSize: 12,
                      lineHeight: 20,
                      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                    }}
                  >
                    {JSON.stringify(orderResponse, null, 2)}
                  </Text>
                </View>
              ) : null}
            </View>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
