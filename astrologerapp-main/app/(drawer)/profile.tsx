import { zodResolver } from "@hookform/resolvers/zod";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  AtSign,
  CalendarDays,
  Camera,
  Link as LinkIcon,
  Mail,
  MapPin,
  Phone,
  User,
  VenusAndMars,
} from "lucide-react-native";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { ExpertiseTagsField } from "@/components/profile/expertise-tags-field";
import { ProfileField } from "@/components/profile/profile-field";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { AppContainer } from "@/src/components/common/app-container";
import { astroColors } from "@/src/constants/colors";
import { astroImages } from "@/src/constants/images";
import {
  AstrologerProfileFormValues,
  astrologerProfileSchema,
} from "@/src/features/profile/profile.schema";
import {
  useAstrologerProfileQuery,
  useUpdateAstrologerProfileMutation,
} from "@/src/features/profile/use-astrologer-profile";

const fallbackProfile: AstrologerProfileFormValues = {
  bio: "",
  dateOfBirth: "",
  email: "",
  expertise: [],
  fullName: "",
  gender: "",
  location: "",
  phoneNumber: "",
  username: "",
};

export default function ProfileScreen() {
  const router = useRouter();
  const profileQuery = useAstrologerProfileQuery();
  const updateProfile = useUpdateAstrologerProfileMutation();

  const form = useForm<AstrologerProfileFormValues>({
    defaultValues: fallbackProfile,
    mode: "onBlur",
    resolver: zodResolver(astrologerProfileSchema),
  });

  useEffect(() => {
    if (profileQuery.data) {
      form.reset(profileQuery.data);
    }
  }, [form, profileQuery.data]);

  const handleSubmit = form.handleSubmit((values) => {
    updateProfile.mutate(values);
  });

  return (
    <AppContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Go back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <ArrowLeft color="#FFFFFF" size={24} strokeWidth={2.2} />
            </Pressable>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>Edit Profile</Text>
              <Text style={styles.subtitle}>Update your information</Text>
            </View>

            <Image
              contentFit="cover"
              source={astroImages.brandMark}
              style={styles.cornerMark}
            />
          </View>

          <View style={styles.avatarBlock}>
            <View style={styles.avatarRing}>
              <Image
                contentFit="cover"
                source={astroImages.logo}
                style={styles.avatar}
              />
              <Pressable style={styles.cameraButton}>
                <Camera color="#061028" size={15} strokeWidth={2.4} />
              </Pressable>
            </View>
            <Text style={styles.changePhoto}>Change profile picture</Text>
          </View>

          {profileQuery.isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={astroColors.gold} />
            </View>
          ) : (
            <View style={styles.form}>
              <ProfileField
                control={form.control}
                icon={User}
                label="Full Name"
                name="fullName"
                placeholder="Enter full name"
              />
              <ProfileField
                autoCapitalize="none"
                control={form.control}
                icon={AtSign}
                label="Username"
                name="username"
                placeholder="@username"
              />
              <ProfileField
                autoCapitalize="none"
                control={form.control}
                icon={Mail}
                keyboardType="email-address"
                label="Email"
                name="email"
                placeholder="email@example.com"
              />
              <ProfileField
                control={form.control}
                icon={CalendarDays}
                label="Date of Birth"
                name="dateOfBirth"
                placeholder="15 March 1990"
              />
              <ProfileField
                control={form.control}
                icon={VenusAndMars}
                label="Gender"
                name="gender"
                placeholder="Male"
              />
              <ProfileField
                control={form.control}
                icon={Phone}
                keyboardType="phone-pad"
                label="Phone Number"
                name="phoneNumber"
                placeholder="+91 98765 43210"
              />
              <ProfileField
                control={form.control}
                icon={MapPin}
                label="Location"
                name="location"
                placeholder="New Delhi, India"
              />
              <ProfileField
                control={form.control}
                icon={LinkIcon}
                label="Bio"
                maxLength={200}
                multiline
                name="bio"
                placeholder="Write a short profile bio"
              />

              <ExpertiseTagsField control={form.control} />

              <Button
                action="primary"
                disabled={updateProfile.isPending}
                onPress={handleSubmit}
                size="xl"
                style={styles.saveButton}
              >
                <ButtonText style={styles.saveButtonText}>
                  {updateProfile.isPending ? "Saving..." : "Save Changes"}
                </ButtonText>
              </Button>

              {updateProfile.isSuccess ? (
                <Text style={styles.success}>
                  Profile updated successfully.
                </Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 36,
  },
  header: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    alignItems: "center",
    flex: 1,
    paddingTop: 3,
  },
  title: {
    color: "#FFFFFF",
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 22,
    lineHeight: 28,
  },
  subtitle: {
    color: "#B6B8D6",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  cornerMark: {
    width: 66,
    height: 66,
    borderRadius: 33,
    opacity: 0.82,
  },
  avatarBlock: {
    alignItems: "center",
    marginTop: 2,
    marginBottom: 16,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#D4A757",
    backgroundColor: "rgba(9,18,44,0.65)",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraButton: {
    position: "absolute",
    right: 0,
    bottom: 3,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#061028",
    backgroundColor: "#D4A757",
  },
  changePhoto: {
    color: "#F0B35D",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    marginTop: 8,
  },
  loadingWrap: {
    minHeight: 300,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: 10,
  },
  saveButton: {
    height: 50,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#D4A757",
  },
  saveButtonText: {
    color: "#061028",
    fontFamily: "Inter_600SemiBold",
  },
  success: {
    color: "#A7F3D0",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    textAlign: "center",
  },
});
