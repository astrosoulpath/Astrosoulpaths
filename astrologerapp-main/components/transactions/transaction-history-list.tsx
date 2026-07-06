import { format, parseISO } from "date-fns";
import { ArrowDown, ArrowUp } from "lucide-react-native";
import { SectionList } from "react-native";

import { Box } from "@/components/ui/box";
import { Divider } from "@/components/ui/divider";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { astroColors } from "@/src/constants/colors";
import { TransactionRecord } from "@/src/features/transactions/transactions.schema";

type TransactionSection = {
  data: TransactionRecord[];
  title: string;
};

type TransactionHistoryListProps = {
  isLoading?: boolean;
  sections: TransactionSection[];
};

function formatCurrency(amount: number, type: TransactionRecord["type"]) {
  const sign = type === "earning" ? "+" : "-";
  const formatted = new Intl.NumberFormat("en-IN", {
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amount);

  return `${sign} ${formatted}`;
}

function formatTimestamp(occurredAt: string) {
  return format(parseISO(occurredAt), "d MMM yyyy, hh:mm a");
}

function statusLabel(transaction: TransactionRecord) {
  return transaction.type === "earning" ? "Completed" : "Successful";
}

export function TransactionHistoryList({
  isLoading = false,
  sections,
}: TransactionHistoryListProps) {
  if (isLoading) {
    return (
      <Box className="items-center justify-center rounded-[28px] border border-white/10 bg-[#0B1431]/92 px-6 py-12">
        <Spinner color={astroColors.gold} />
      </Box>
    );
  }

  return (
    <Box className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0B1431]/92">
      <SectionList
        ListFooterComponent={
          <Text
            style={{
              color: astroColors.muted,
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 18,
              paddingBottom: 24,
              paddingTop: 10,
              textAlign: "center",
            }}
          >
            Showing all transactions
          </Text>
        }
        contentContainerStyle={{ paddingBottom: 4 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index, section }) => {
          const positive = item.type === "earning";
          const isLast = index === section.data.length - 1;

          return (
            <Box className="px-5">
              <HStack className="items-center justify-between gap-4 py-5">
                <HStack className="flex-1 items-center gap-4">
                  <Box
                    className="h-14 w-14 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: positive
                        ? "rgba(57, 212, 107, 0.16)"
                        : "rgba(125, 92, 255, 0.16)",
                    }}
                  >
                    {positive ? (
                      <ArrowDown color="#66EA86" size={26} strokeWidth={2.1} />
                    ) : (
                      <ArrowUp color="#A88DFF" size={26} strokeWidth={2.1} />
                    )}
                  </Box>

                  <VStack className="flex-1 gap-1">
                    <Text
                      style={{
                        color: astroColors.white,
                        fontFamily: "Inter_500Medium",
                        fontSize: 17,
                        lineHeight: 22,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        color: astroColors.muted,
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      {formatTimestamp(item.occurredAt)}
                    </Text>
                  </VStack>
                </HStack>

                <VStack className="items-end gap-2">
                  <Text
                    style={{
                      color: positive ? "#39D46B" : "#FF5E61",
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 16,
                      lineHeight: 20,
                    }}
                  >
                    {formatCurrency(item.amount, item.type)}
                  </Text>
                  <Box
                    className="rounded-xl px-3 py-1.5"
                    style={{
                      backgroundColor: positive
                        ? "rgba(57, 212, 107, 0.14)"
                        : "rgba(255, 94, 97, 0.14)",
                    }}
                  >
                    <Text
                      style={{
                        color: positive ? "#66EA86" : "#FF6F71",
                        fontFamily: "Inter_500Medium",
                        fontSize: 13,
                        lineHeight: 16,
                      }}
                    >
                      {statusLabel(item)}
                    </Text>
                  </Box>
                </VStack>
              </HStack>

              {!isLast ? <Divider className="bg-white/6" /> : null}
            </Box>
          );
        }}
        renderSectionHeader={({ section }) => (
          <Box className="border-t border-white/8 bg-[#0B1431] px-5 py-4 first:border-t-0">
            <Text
              style={{
                color: astroColors.white,
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                lineHeight: 18,
              }}
            >
              {section.title}
            </Text>
          </Box>
        )}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
      />
    </Box>
  );
}
