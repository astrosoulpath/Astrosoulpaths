import { StyleSheet, Text, View } from "react-native";

import { astroColors } from "@/src/constants/colors";

type Props = {
  logs: Array<{
    id: string;
    message: string;
  }>;
};

export function CallLogList({ logs }: Props) {
  return (
    <View style={styles.shell}>
      <Text style={styles.title}>Flow trace</Text>
      {logs.length === 0 ? (
        <Text style={styles.empty}>No call events yet.</Text>
      ) : (
        logs.map((log) => (
          <View key={log.id} style={styles.item}>
            <View style={styles.dot} />
            <Text style={styles.message}>{log.message}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: astroColors.gold,
    borderRadius: 999,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  empty: {
    color: astroColors.muted,
    fontSize: 14,
  },
  item: {
    columnGap: 12,
    flexDirection: "row",
  },
  message: {
    color: astroColors.white,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  shell: {
    backgroundColor: "rgba(8, 16, 40, 0.78)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  title: {
    color: astroColors.goldBright,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
});
