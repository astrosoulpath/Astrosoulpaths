import AuthGlassCard from "@/components/auth/glass";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  transformOnboardingProfilePayload,
  validateOnboardingProfilePayload,
} from "@/features/profile/api/profile.transform";
import { FrontendOnboardingPayload } from "@/features/profile/api/profile.types";
import { appRoutes } from "@/src/navigation/routes";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PREVIEW_STEPS = [
  {
    title: "Tell us your name",
    description:
      "Start with the name you want to see across your spiritual profile.",
    fieldLabel: "Full Name",
    placeholder: "Your full name",
  },
  {
    title: "Pick your birth date",
    description: "We use your date of birth to anchor the chart correctly.",
    fieldLabel: "Date of Birth",
    placeholder: "DD / MM / YYYY",
  },
  {
    title: "Add your birth time",
    description: "Even an approximate time improves the accuracy of readings.",
    fieldLabel: "Time of Birth",
    placeholder: "HH : MM AM",
  },
  {
    title: "Choose your birthplace",
    description:
      "Search your birth city or use your current location to resolve a place quickly.",
    fieldLabel: "Birth Place",
    placeholder: "Search city",
  },
  {
    title: "Select your gender",
    description:
      "A compact selection step with the same visual language as the rest of the flow.",
    fieldLabel: "Gender",
    placeholder: "Male / Female",
  },
] as const;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDate(date: Date) {
  return `${pad(date.getDate())} / ${pad(date.getMonth() + 1)} / ${date.getFullYear()}`;
}

function formatTime(date: Date) {
  const hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const meridiem = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${pad(displayHours)} : ${minutes} ${meridiem}`;
}

function parseDate(value: string) {
  const normalized = value.replace(/\s/g, "");
  const [day, month, year] = normalized.split("/").map(Number);

  if (!day || !month || !year) {
    return new Date();
  }

  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function parseTime(value: string) {
  const match = value.match(/(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)/i);
  const parsed = new Date();

  if (!match) {
    parsed.setHours(9, 0, 0, 0);
    return parsed;
  }

  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  const normalizedHours = rawHours % 12;
  const hours = meridiem === "PM" ? normalizedHours + 12 : normalizedHours;

  parsed.setHours(hours, minutes, 0, 0);
  return parsed;
}

function formatUtcOffset(offsetSeconds: number | null) {
  if (offsetSeconds === null) {
    return null;
  }

  const sign = offsetSeconds >= 0 ? "+" : "-";
  const absoluteSeconds = Math.abs(offsetSeconds);
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);

  return `UTC${sign}${pad(hours)}:${pad(minutes)}`;
}

function formatUtcDecimal(offsetSeconds: number | null) {
  if (offsetSeconds === null) {
    return null;
  }

  return Number((offsetSeconds / 3600).toFixed(2));
}

function toUtcDateTime(
  dateValue: string,
  timeValue: string,
  utcCode: number | null,
) {
  if (!dateValue || !timeValue || utcCode === null) {
    return null;
  }

  const parsedDate = parseDate(dateValue);
  const parsedTime = parseTime(timeValue);
  const offsetMinutes = Math.round(utcCode * 60);
  const utcTimestamp =
    Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
      parsedTime.getHours(),
      parsedTime.getMinutes(),
      0,
      0,
    ) -
    offsetMinutes * 60 * 1000;

  if (Number.isNaN(utcTimestamp)) {
    return null;
  }

  return new Date(utcTimestamp).toISOString();
}

async function fetchTimeZoneDetails(latitude: number, longitude: number) {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: "temperature_2m",
    timezone: "auto",
    forecast_days: "1",
  });
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to resolve timezone details for coordinates.");
  }

  const data = (await response.json()) as {
    timezone?: string;
    utc_offset_seconds?: number;
  };
  const offsetSeconds =
    typeof data.utc_offset_seconds === "number"
      ? data.utc_offset_seconds
      : null;

  return {
    timeZone: data.timezone ?? null,
    timeCode: formatUtcOffset(offsetSeconds),
    utcCode: formatUtcDecimal(offsetSeconds),
  };
}

export default function OnboardingPreviewScreen() {
  const router = useRouter();
  const setNextStep = useAuthStore((state) => state.setNextStep);
  const setUser = useAuthStore((state) => state.setUser);
  const scrollRef = React.useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [timeOfBirth, setTimeOfBirth] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [birthLatitude, setBirthLatitude] = useState<number | null>(null);
  const [birthLongitude, setBirthLongitude] = useState<number | null>(null);
  const [birthTimeZone, setBirthTimeZone] = useState<string | null>(null);
  const [birthTimeCode, setBirthTimeCode] = useState<string | null>(null);
  const [birthUtcCode, setBirthUtcCode] = useState<number | null>(null);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [locationError, setLocationError] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationHint, setLocationHint] = useState(
    "Use current location or search a city by name.",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDate(dateOfBirth));
  const [draftTime, setDraftTime] = useState(() => parseTime(timeOfBirth));

  const slideWidth = width - 40;

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / slideWidth,
    );
    setActiveIndex(nextIndex);
  };

  const scrollToIndex = (nextIndex: number) => {
    scrollRef.current?.scrollTo({
      x: nextIndex * slideWidth,
      animated: true,
    });
    setActiveIndex(nextIndex);
  };

  const openDatePicker = () => {
    setDraftDate(parseDate(dateOfBirth));
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    setDraftTime(parseTime(timeOfBirth));
    setShowTimePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
  };

  const closeTimePicker = () => {
    setShowTimePicker(false);
  };

  const handleExitOnboarding = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/dev-nav" as never);
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    if (Platform.OS === "ios") {
      setDraftDate(selectedDate);
      return;
    }

    setDateOfBirth(formatDate(selectedDate));
  };

  const handleTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }

    if (event.type === "dismissed" || !selectedTime) {
      return;
    }

    if (Platform.OS === "ios") {
      setDraftTime(selectedTime);
      return;
    }

    setTimeOfBirth(formatTime(selectedTime));
  };

  const confirmDate = () => {
    setDateOfBirth(formatDate(draftDate));
    closeDatePicker();
  };

  const confirmTime = () => {
    setTimeOfBirth(formatTime(draftTime));
    closeTimePicker();
  };

  const getPreviewPayload = (): FrontendOnboardingPayload => {
    return {
      fullName: fullName.trim(),
      dateOfBirth,
      timeOfBirth,
      birthPlace: birthPlace.trim(),
      latitude: birthLatitude,
      longitude: birthLongitude,
      timeZone: birthTimeZone,
      timeCode: birthTimeCode,
      utcCode: birthUtcCode,
      utc: toUtcDateTime(dateOfBirth, timeOfBirth, birthUtcCode),
      gender,
    };
  };

  const handleFinishPreview = async () => {
    const payload = getPreviewPayload();
    const validationError = validateOnboardingProfilePayload(payload);

    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitError("");

    const transformedPayload = transformOnboardingProfilePayload(payload);

    try {
      setIsSubmitting(true);

      const response = await authApi.submitProfile(transformedPayload);

      setNextStep(response.nextStep ?? null);
      setUser(response.user);

      if (response.nextStep === "OPEN_HOME") {
        router.replace(appRoutes.home as never);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to save profile right now.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError("");
      setSubmitError("");

      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setLocationError("Location permission is required to fetch your city.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const resolved = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      const place = resolved[0];
      const nextCity = [place?.city, place?.region || place?.subregion]
        .filter(Boolean)
        .join(", ");

      if (!nextCity) {
        setLocationError(
          "We could not resolve a city from your current location.",
        );
        return;
      }

      setBirthPlace(nextCity);
      setBirthLatitude(position.coords.latitude);
      setBirthLongitude(position.coords.longitude);
      const timezoneDetails = await fetchTimeZoneDetails(
        position.coords.latitude,
        position.coords.longitude,
      );

      setBirthTimeZone(timezoneDetails.timeZone);
      setBirthTimeCode(timezoneDetails.timeCode);
      setBirthUtcCode(timezoneDetails.utcCode);
      setLocationHint("Current location resolved successfully.");
    } catch {
      setLocationError("Unable to fetch your location details right now.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSearchCity = async () => {
    const query = birthPlace.trim();

    if (!query) {
      setLocationError("Enter a city name to search.");
      return;
    }

    try {
      setLocationLoading(true);
      setLocationError("");
      setSubmitError("");

      const geocoded = await Location.geocodeAsync(query);

      if (!geocoded.length) {
        setLocationError("No city matched that search.");
        return;
      }

      const resolved = await Location.reverseGeocodeAsync({
        latitude: geocoded[0].latitude,
        longitude: geocoded[0].longitude,
      });

      const place = resolved[0];
      const nextCity = [place?.city || query, place?.region || place?.subregion]
        .filter(Boolean)
        .join(", ");

      setBirthPlace(nextCity || query);
      setBirthLatitude(geocoded[0].latitude);
      setBirthLongitude(geocoded[0].longitude);
      const timezoneDetails = await fetchTimeZoneDetails(
        geocoded[0].latitude,
        geocoded[0].longitude,
      );

      setBirthTimeZone(timezoneDetails.timeZone);
      setBirthTimeCode(timezoneDetails.timeCode);
      setBirthUtcCode(timezoneDetails.utcCode);
      setLocationHint("City resolved from your search.");
    } catch {
      setLocationError(
        "Unable to resolve timezone for that birthplace right now.",
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const renderStepContent = (index: number) => {
    if (index === 0) {
      return (
        <VStack className="gap-5">
          <View style={styles.fieldShell}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="rgba(184, 188, 214, 0.52)"
              style={styles.input}
            />
          </View>
          <Text style={styles.helperText}>
            Keep this clean and personal. This route is still a preview, but the
            interaction is now real.
          </Text>
        </VStack>
      );
    }

    if (index === 1) {
      return (
        <VStack className="gap-5">
          <Pressable onPress={openDatePicker} style={styles.fieldShell}>
            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <Text
              style={[styles.input, !dateOfBirth && styles.placeholderText]}
            >
              {dateOfBirth || "DD / MM / YYYY"}
            </Text>
          </Pressable>
          <Text style={styles.helperText}>
            Pick the actual date here instead of typing it manually.
          </Text>
        </VStack>
      );
    }

    if (index === 2) {
      return (
        <VStack className="gap-5">
          <Pressable onPress={openTimePicker} style={styles.fieldShell}>
            <Text style={styles.fieldLabel}>Time of Birth</Text>
            <Text
              style={[styles.input, !timeOfBirth && styles.placeholderText]}
            >
              {timeOfBirth || "HH : MM AM"}
            </Text>
          </Pressable>
          <Text style={styles.helperText}>
            Use the native time picker so this step feels finished as well.
          </Text>
        </VStack>
      );
    }

    if (index === 3) {
      return (
        <VStack className="gap-4">
          <View style={styles.fieldShell}>
            <Text style={styles.fieldLabel}>Birth Place</Text>
            <TextInput
              value={birthPlace}
              onChangeText={(value) => {
                setBirthPlace(value);
                setBirthLatitude(null);
                setBirthLongitude(null);
                setBirthTimeZone(null);
                setBirthTimeCode(null);
                setBirthUtcCode(null);
                setLocationError("");
                setSubmitError("");
              }}
              placeholder="Search city"
              placeholderTextColor="rgba(184, 188, 214, 0.52)"
              style={styles.input}
            />
          </View>

          <View className="flex-row gap-3">
            <Pressable
              onPress={handleUseCurrentLocation}
              disabled={locationLoading}
              className="flex-1 rounded-[18px] border border-[rgba(232,193,126,0.22)] bg-[rgba(232,193,126,0.09)] px-4 py-3"
            >
              <Text className="text-center text-[13px] font-semibold text-[#F4E7C7]">
                Use Current Location
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSearchCity}
              disabled={locationLoading}
              className="rounded-[18px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-4 py-3"
            >
              <Text className="text-[13px] font-semibold text-[#F4F1FA]">
                Search
              </Text>
            </Pressable>
          </View>

          {locationLoading ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="#E8C17E" size="small" />
              <Text style={styles.helperText}>Resolving location...</Text>
            </View>
          ) : locationError ? (
            <Text style={styles.errorText}>{locationError}</Text>
          ) : (
            <Text style={styles.helperText}>{locationHint}</Text>
          )}
        </VStack>
      );
    }

    return (
      <VStack className="gap-4">
        <View className="gap-3">
          {[
            { label: "Male", value: "male" },
            { label: "Female", value: "female" },
          ].map((option) => {
            const isSelected = gender === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => setGender(option.value as typeof gender)}
                className="rounded-[20px] border px-4 py-4"
                style={isSelected ? styles.selectedCard : styles.optionCard}
              >
                <Text className="text-[15px] font-semibold text-[#F4F1FA]">
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          This keeps the last step visually aligned with the card and input
          styling used through the rest of the preview.
        </Text>
      </VStack>
    );
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      className="flex-1 bg-[#060A1C]"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 px-5 pb-6 pt-3">
          <View className="mb-5 flex-row items-center justify-between">
            <Pressable
              onPress={handleExitOnboarding}
              className="h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)]"
            >
              <ChevronLeft size={18} color="#F5E7C7" />
            </Pressable>

            <VStack className="items-center">
              <Text className="text-[11px] font-semibold uppercase tracking-[2.6px] text-[rgba(232,193,126,0.82)]">
                Preview Only
              </Text>
              <Text className="mt-1 text-[17px] font-semibold text-[#F5F1FF]">
                New User Boarding
              </Text>
            </VStack>

            <View className="min-w-[40px] items-end">
              <Text className="text-[13px] text-[rgba(214,217,245,0.72)]">
                {activeIndex + 1}/{PREVIEW_STEPS.length}
              </Text>
            </View>
          </View>

          <View className="mb-5 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.07)]">
            <View
              style={{
                width: `${((activeIndex + 1) / PREVIEW_STEPS.length) * 100}%`,
              }}
              className="h-full rounded-full bg-[#E8C17E]"
            />
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleMomentumEnd}
            contentContainerStyle={styles.track}
          >
            {PREVIEW_STEPS.map((step, index) => (
              <View
                key={step.fieldLabel}
                style={[styles.slideWrap, { width: slideWidth }]}
              >
                <AuthGlassCard
                  size="md"
                  radius="xl"
                  elevation="high"
                  floatingBadge={
                    <Sparkles size={18} color="#F4C56D" strokeWidth={2.2} />
                  }
                  floatingBadgeSize={56}
                  floatingBadgeOffsetY={-28}
                  title={step.title}
                  subtitle={step.description}
                  titleClassName="text-center text-[24px] font-bold leading-[30px] text-[#F4F1FA]"
                  subtitleClassName="mt-2 text-center text-[13px] leading-[20px] text-[rgba(214,217,245,0.74)]"
                  backgroundColor="rgba(20, 24, 58, 0.9)"
                  borderGradientColors={[
                    "rgba(232,193,126,0.9)",
                    "rgba(110,95,189,0.46)",
                  ]}
                  surfaceGradientColors={[
                    "rgba(68, 69, 130, 0.22)",
                    "rgba(35, 35, 92, 0.14)",
                    "rgba(19, 22, 67, 0.84)",
                  ]}
                  overlayGradientColors={[
                    "rgba(255,255,255,0.08)",
                    "rgba(255,255,255,0.02)",
                    "rgba(228,185,106,0.06)",
                  ]}
                >
                  <VStack className="gap-5">
                    {renderStepContent(index)}

                    <View className="flex-row items-center justify-between pt-1">
                      <Pressable
                        onPress={() => scrollToIndex(Math.max(0, index - 1))}
                        disabled={index === 0}
                        className={`rounded-full border px-4 py-3 ${
                          index === 0
                            ? "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)]"
                            : "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)]"
                        }`}
                      >
                        <Text className="text-[13px] font-semibold text-[#F4F1FA]">
                          Previous
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          if (index === PREVIEW_STEPS.length - 1) {
                            void handleFinishPreview();
                            return;
                          }

                          scrollToIndex(
                            Math.min(PREVIEW_STEPS.length - 1, index + 1),
                          );
                        }}
                        disabled={
                          index === PREVIEW_STEPS.length - 1 && isSubmitting
                        }
                        className="flex-row items-center gap-2 rounded-full border border-[rgba(232,193,126,0.32)] bg-[rgba(232,193,126,0.12)] px-4 py-3"
                      >
                        <Text className="text-[13px] font-semibold text-[#F4F1FA]">
                          {index === PREVIEW_STEPS.length - 1
                            ? isSubmitting
                              ? "Saving..."
                              : "Finish Preview"
                            : "Next"}
                        </Text>
                        {index === PREVIEW_STEPS.length - 1 ? null : (
                          <ChevronRight size={14} color="#F4F1FA" />
                        )}
                      </Pressable>
                    </View>

                    {index === PREVIEW_STEPS.length - 1 && submitError ? (
                      <Text style={styles.errorText}>{submitError}</Text>
                    ) : null}
                  </VStack>
                </AuthGlassCard>
              </View>
            ))}
          </ScrollView>

          {showDatePicker && Platform.OS === "android" ? (
            <DateTimePicker
              value={parseDate(dateOfBirth)}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handleDateChange}
            />
          ) : null}

          {showTimePicker && Platform.OS === "android" ? (
            <DateTimePicker
              value={parseTime(timeOfBirth)}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          ) : null}

          <Modal
            transparent
            animationType="fade"
            visible={showDatePicker && Platform.OS === "ios"}
            onRequestClose={closeDatePicker}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={closeDatePicker}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={confirmDate}>
                    <Text style={styles.modalConfirm}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={draftDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={handleDateChange}
                />
              </View>
            </View>
          </Modal>

          <Modal
            transparent
            animationType="fade"
            visible={showTimePicker && Platform.OS === "ios"}
            onRequestClose={closeTimePicker}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={closeTimePicker}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={confirmTime}>
                    <Text style={styles.modalConfirm}>Done</Text>
                  </Pressable>
                </View>
                <DateTimePicker
                  value={draftTime}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                />
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  track: {
    alignItems: "stretch",
    paddingTop: 16,
    paddingBottom: 6,
  },
  slideWrap: {
    width: "100%",
    paddingHorizontal: 8,
  },
  fieldShell: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(232,193,126,0.16)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  fieldLabel: {
    color: "rgba(232,193,126,0.74)",
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  input: {
    marginTop: 12,
    color: "#F4F1FA",
    fontSize: 16,
    minHeight: 24,
    paddingVertical: 2,
  },
  placeholderText: {
    color: "rgba(184, 188, 214, 0.52)",
  },
  helperText: {
    color: "rgba(214,217,245,0.58)",
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: "#FF7A7A",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  optionCard: {
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  selectedCard: {
    borderColor: "rgba(232,193,126,0.42)",
    backgroundColor: "rgba(232,193,126,0.12)",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(232,193,126,0.2)",
    backgroundColor: "#140f24",
    padding: 16,
  },
  modalHeader: {
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalCancel: {
    color: "rgba(214,217,245,0.72)",
    fontSize: 14,
    fontWeight: "600",
  },
  modalConfirm: {
    color: "#E8C17E",
    fontSize: 14,
    fontWeight: "700",
  },
});
