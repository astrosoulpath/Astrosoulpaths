import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  TransactionFilter,
  transactionFilters,
} from "@/src/features/transactions/transactions.schema";

type TransactionFilterTabsProps = {
  activeFilter: TransactionFilter;
  onChange: (value: TransactionFilter) => void;
};

const tabTextColors: Record<TransactionFilter, string> = {
  all: "#E0B24F",
  earnings: "#39D46B",
  payouts: "#FF5E61",
};

export function TransactionFilterTabs({
  activeFilter,
  onChange,
}: TransactionFilterTabsProps) {
  return (
    <Box className="rounded-[24px] border border-white/10 bg-[#0B1431]/92 px-3 py-3">
      <HStack className="items-center justify-between gap-3">
        {transactionFilters.map((filter) => {
          const isActive = filter.value === activeFilter;

          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              className="flex-1 items-center justify-center rounded-2xl px-2 py-2.5"
              onPress={() => onChange(filter.value)}
            >
              <Box className="items-center">
                <Text
                  style={{
                    color: tabTextColors[filter.value],
                    fontFamily: isActive
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                    fontSize: 16,
                    lineHeight: 20,
                  }}
                >
                  {filter.label}
                </Text>

                <Box
                  className="mt-3 h-[2px] w-16 rounded-full"
                  style={{
                    backgroundColor: tabTextColors[filter.value],
                    opacity: isActive ? 1 : 0,
                    transform: [
                      {
                        scaleX: isActive ? 1 : 0.4,
                      },
                    ],
                  }}
                />
              </Box>
            </Pressable>
          );
        })}
      </HStack>
    </Box>
  );
}