import { BirthPlaceSelector } from "@/components/kundli/BirthPlaceSelector";
import { DatePickerSection } from "@/components/kundli/DatePickerSection";
import { GenerateButton } from "@/components/kundli/GenerateButton";
import { Header } from "@/components/kundli/Header";
import { KundliCard } from "@/components/kundli/KundliCard";
import { LocalCloudSwitcher } from "@/components/kundli/LocalCloudSwitcher";
import { OpenKundliSearch } from "@/components/kundli/OpenKundliSearch";
import { ProfileSection } from "@/components/kundli/ProfileSection";
import { SaveKundliSection } from "@/components/kundli/SaveKundliSection";
import { TabSwitcher } from "@/components/kundli/TabSwitcher";
import { TimePickerSection } from "@/components/kundli/TimePickerSection";
import { TypePasteSection } from "@/components/kundli/TypePasteSection";
import { Text } from "@/components/ui/text";
import {
  useGenerateKundli,
  useOpenKundliList,
} from "@/features/kundli/hooks/useKundli";
import { kundliSchema } from "@/features/kundli/schemas/kundli.schema";
import { useKundliStore } from "@/features/kundli/store/kundli.store";
import {
  GeoSuggestion,
  KundliFormValues,
  KundliSummary,
  KundliTab,
} from "@/features/kundli/types/kundli.types";
import { zodResolver } from "@hookform/resolvers/zod";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type KundliHubScreenProps = {
  onBack?: () => void;
};

function formatBirthPlaceDisplay(suggestion: GeoSuggestion) {
  return [suggestion.city, suggestion.state, suggestion.country]
    .filter(Boolean)
    .join(", ");
}

const defaultValues: KundliFormValues = {
  fullName: "",
  gender: "male",
  dateOfBirth: "",
  timeOfBirth: "",
  birthPlace: "",
  notes: "",
  saveMode: "local",
};

function createLocalSummary(values: KundliFormValues): KundliSummary {
  const timestamp = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    fullName: values.fullName,
    gender: values.gender,
    dateOfBirth: values.dateOfBirth,
    timeOfBirth: values.timeOfBirth,
    birthPlace: values.birthPlace,
    source: "local",
    createdAt: timestamp,
  };
}

export function KundliHubScreen({ onBack }: KundliHubScreenProps) {
  const [activeTab, setActiveTab] = React.useState<KundliTab>("new");

  const {
    control,
    handleSubmit,
    formState,
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<KundliFormValues>({
    resolver: zodResolver(kundliSchema),
    defaultValues,
  });

  const fullName = watch("fullName");
  const gender = watch("gender");

  const mode = useKundliStore((state) => state.activeSource);
  const search = useKundliStore((state) => state.openSearchQuery);
  const setSource = useKundliStore((state) => state.setSource);
  const setSearch = useKundliStore((state) => state.setOpenSearchQuery);
  const addLocalKundli = useKundliStore((state) => state.addLocalKundli);

  const generateKundli = useGenerateKundli();
  const openKundliList = useOpenKundliList(mode, search);

  const clearBirthPlaceGeoFields = React.useCallback(() => {
    setValue("city", undefined, { shouldDirty: true });
    setValue("latitude", undefined, { shouldDirty: true });
    setValue("longitude", undefined, { shouldDirty: true });
    setValue("timezone", undefined, { shouldDirty: true });
    setValue("timezoneName", undefined, { shouldDirty: true });
    setValue("state", undefined, { shouldDirty: true });
    setValue("country", undefined, { shouldDirty: true });
    setValue("countryCode", undefined, { shouldDirty: true });
    setValue("selectedGeo", undefined, { shouldDirty: true });
  }, [setValue]);

  const applyBirthPlaceSuggestion = React.useCallback(
    (suggestion: GeoSuggestion) => {
      const displayValue = formatBirthPlaceDisplay(suggestion);

      setValue("birthPlace", displayValue, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setValue("selectedGeo", suggestion, { shouldDirty: true });
      setValue("city", suggestion.city, { shouldDirty: true });
      setValue("latitude", suggestion.latitude, { shouldDirty: true });
      setValue("longitude", suggestion.longitude, { shouldDirty: true });
      setValue("timezone", suggestion.timezone, { shouldDirty: true });
      setValue("timezoneName", suggestion.timezoneName, { shouldDirty: true });
      setValue("state", suggestion.state, { shouldDirty: true });
      setValue("country", suggestion.country, { shouldDirty: true });
      setValue("countryCode", suggestion.countryCode, { shouldDirty: true });
    },
    [setValue],
  );

  const onSubmit = handleSubmit(async (values) => {
    if (values.saveMode === "local") {
      addLocalKundli(createLocalSummary(values));
      reset(defaultValues);
      setActiveTab("open");
      return;
    }

    await generateKundli.mutateAsync(values);
    reset(defaultValues);
    setSource("cloud");
    setActiveTab("open");
  });

  return (
    <SafeAreaView
      className="flex-1 bg-[#090405]"
      edges={["top", "left", "right"]}
    >
      <StatusBar style="light" />
      <ImageBackground
        source={require("@/assets/images/vedicbg.png")}
        resizeMode="cover"
        className="flex-1"
      >
        <LinearGradient
          colors={["rgba(8,2,4,0.86)", "rgba(23,5,8,0.90)", "rgba(7,2,3,0.94)"]}
          className="absolute inset-0"
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 36,
            paddingTop: 10,
          }}
        >
          <Header
            title="Vedic Kundli"
            subtitle="Sacred birth chart intelligence with premium local/cloud flow"
            onBack={onBack ?? (() => router.back())}
          />

          <TabSwitcher activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === "new" ? (
            <View className="gap-3">
              <ProfileSection
                fullName={fullName}
                onFullNameChange={(value) =>
                  setValue("fullName", value, { shouldValidate: true })
                }
                gender={gender}
                onGenderChange={(value) =>
                  setValue("gender", value, { shouldValidate: true })
                }
                nameError={formState.errors.fullName?.message}
              />

              <Controller
                control={control}
                name="dateOfBirth"
                render={({ field }) => (
                  <DatePickerSection
                    value={field.value}
                    onChange={field.onChange}
                    error={formState.errors.dateOfBirth?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="timeOfBirth"
                render={({ field }) => (
                  <TimePickerSection
                    value={field.value}
                    onChange={field.onChange}
                    error={formState.errors.timeOfBirth?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="birthPlace"
                render={({ field }) => (
                  <BirthPlaceSelector
                    value={field.value}
                    onChange={(nextValue) => {
                      field.onChange(nextValue);

                      const selectedGeo = getValues("selectedGeo");
                      const selectedDisplay = selectedGeo
                        ? formatBirthPlaceDisplay(selectedGeo)
                        : "";

                      if (nextValue.trim() !== selectedDisplay) {
                        clearBirthPlaceGeoFields();
                      }

                      if (!nextValue.trim()) {
                        clearBirthPlaceGeoFields();
                      }
                    }}
                    onSelectSuggestion={applyBirthPlaceSuggestion}
                    error={formState.errors.birthPlace?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="saveMode"
                render={({ field }) => (
                  <SaveKundliSection
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <TypePasteSection
                    value={field.value ?? ""}
                    onChange={field.onChange}
                  />
                )}
              />

              {generateKundli.isError ? (
                <Text className="text-center text-xs text-[#ff9d9d]">
                  Unable to generate cloud kundli right now. Try local mode or
                  check API.
                </Text>
              ) : null}

              {formState.errors.notes?.message ? (
                <Text className="text-center text-xs text-[#ff9d9d]">
                  {formState.errors.notes.message}
                </Text>
              ) : null}

              <GenerateButton
                onPress={onSubmit}
                isLoading={generateKundli.isPending}
              />
            </View>
          ) : (
            <View>
              <OpenKundliSearch value={search} onChange={setSearch} />
              <LocalCloudSwitcher value={mode} onChange={setSource} />

              {openKundliList.isLoading ? (
                <View className="items-center py-10">
                  <ActivityIndicator color="#F3C66E" />
                </View>
              ) : null}

              {!openKundliList.isLoading && openKundliList.data.length === 0 ? (
                <View className="rounded-2xl border border-[#f3c66e3f] bg-[#160a0ed1] p-5">
                  <Text className="text-center text-sm text-[#e7d3ab]">
                    No kundli records found for this source.
                  </Text>
                </View>
              ) : null}

              {openKundliList.isError ? (
                <Text className="pb-3 text-center text-xs text-[#ff9d9d]">
                  Cloud records unavailable right now.
                </Text>
              ) : null}

              {openKundliList.data.map((item) => (
                <KundliCard key={item.id} item={item} />
              ))}
            </View>
          )}
        </ScrollView>
      </ImageBackground>
    </SafeAreaView>
  );
}

export default KundliHubScreen;
