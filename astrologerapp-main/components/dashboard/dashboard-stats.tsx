import {
  CalendarClock,
  IndianRupee,
  MessageCircle,
  PhoneCall,
  Star,
  UserRoundCheck,
} from "lucide-react-native";
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

import type { AstrologerDashboardData } from "@/src/features/dashboard/dashboard.types";

type DashboardStatsProps = {
  data: AstrologerDashboardData;
  style?: StyleProp<ViewStyle>;
};

type DashboardStatItem = {
  key: string;
  label: string;
  value: string;
  icon: React.ReactNode;
};

function formatCurrency(value: number): string {
  const normalizedValue = Number.isFinite(value) ? value : 0;

  return `₹${normalizedValue.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function formatRating(value: number): string {
  const normalizedValue = Number.isFinite(value) ? value : 0;

  return normalizedValue.toFixed(1);
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function DashboardStats({
  data,
  style,
}: DashboardStatsProps) {
  const profileCompletion = clampPercentage(data.profileCompletion);

  const items: DashboardStatItem[] = [
    {
      key: "earnings",
      label: "Today's Earnings",
      value: formatCurrency(data.earnings),
      icon: (
        <IndianRupee
          color="#F3C873"
          size={22}
          strokeWidth={2.2}
        />
      ),
    },
    {
      key: "calls",
      label: "Today's Calls",
      value: String(data.todayCalls ?? 0),
      icon: (
        <PhoneCall
          color="#8BD3FF"
          size={22}
          strokeWidth={2.2}
        />
      ),
    },
    {
      key: "chats",
      label: "Today's Chats",
      value: String(data.todayChats ?? 0),
      icon: (
        <MessageCircle
          color="#B8A7FF"
          size={22}
          strokeWidth={2.2}
        />
      ),
    },
    {
      key: "rating",
      label: "Rating",
      value: formatRating(data.rating),
      icon: (
        <Star
          color="#F3C873"
          fill="#F3C873"
          size={22}
          strokeWidth={2}
        />
      ),
    },
    {
      key: "pending",
      label: "Pending Consultations",
      value: String(data.pendingConsultations ?? 0),
      icon: (
        <CalendarClock
          color="#FFB48A"
          size={22}
          strokeWidth={2.2}
        />
      ),
    },
    {
      key: "profile",
      label: "Profile Completion",
      value: `${profileCompletion}%`,
      icon: (
        <UserRoundCheck
          color="#8DE5B1"
          size={22}
          strokeWidth={2.2}
        />
      ),
    },
  ];

  return (
    <View style={[styles.root, style]}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>OVERVIEW</Text>
          <Text style={styles.heading}>Today&apos;s Summary</Text>
        </View>

        <View
          style={[
            styles.statusPill,
            data.isOnline
              ? styles.statusPillOnline
              : styles.statusPillOffline,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              data.isOnline
                ? styles.statusDotOnline
                : styles.statusDotOffline,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              data.isOnline
                ? styles.statusTextOnline
                : styles.statusTextOffline,
            ]}
          >
            {data.isOnline ? "Online" : "Offline"}
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.key} style={styles.card}>
            <View style={styles.iconWrap}>{item.icon}</View>

            <Text numberOfLines={1} style={styles.value}>
              {item.value}
            </Text>

            <Text numberOfLines={2} style={styles.label}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View>
            <Text style={styles.profileTitle}>Profile strength</Text>
            <Text style={styles.profileSubtitle}>
              Complete your profile to improve visibility.
            </Text>
          </View>

          <Text style={styles.profileValue}>{profileCompletion}%</Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${profileCompletion}%`,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
  },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  eyebrow: {
    color: "rgba(243, 200, 115, 0.78)",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 1.6,
    lineHeight: 15,
  },
  heading: {
    color: "#FFFFFF",
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 25,
    lineHeight: 32,
    marginTop: 3,
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  statusPillOnline: {
    backgroundColor: "rgba(69, 209, 132, 0.1)",
    borderColor: "rgba(69, 209, 132, 0.32)",
  },
  statusPillOffline: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.11)",
  },
  statusDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  statusDotOnline: {
    backgroundColor: "#45D184",
  },
  statusDotOffline: {
    backgroundColor: "#8F95AA",
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    lineHeight: 16,
  },
  statusTextOnline: {
    color: "#7AE5A9",
  },
  statusTextOffline: {
    color: "#B7BACC",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    backgroundColor: "rgba(16, 28, 67, 0.72)",
    borderColor: "rgba(126, 148, 213, 0.18)",
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 142,
    padding: 16,
    width: "48%",
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.055)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginBottom: 14,
    width: 42,
  },
  value: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    lineHeight: 30,
  },
  label: {
    color: "#BFC4DE",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  profileCard: {
    backgroundColor: "rgba(16, 28, 67, 0.72)",
    borderColor: "rgba(126, 148, 213, 0.18)",
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
    padding: 17,
  },
  profileHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
  },
  profileTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 20,
  },
  profileSubtitle: {
    color: "#AEB4D0",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    maxWidth: 240,
  },
  profileValue: {
    color: "#F3C873",
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    lineHeight: 23,
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    height: 8,
    marginTop: 16,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    backgroundColor: "#F3C873",
    borderRadius: 999,
    height: "100%",
  },
});