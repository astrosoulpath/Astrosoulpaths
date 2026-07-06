import { Text } from "@/components/ui/text";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { SectionCard } from "./SectionCard";

type DatePickerSectionProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function parseDate(value: string) {
  const [day, month, year] = value.split("/").map(Number);

  if (!day || !month || !year) {
    return new Date();
  }

  const parsed = new Date(year, month - 1, day);

  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

export function DatePickerSection({
  value,
  onChange,
  error,
}: DatePickerSectionProps) {
  const [showPicker, setShowPicker] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState(() => parseDate(value));

  const openPicker = () => {
    setDraftDate(parseDate(value));
    setShowPicker(true);
  };

  const closePicker = () => {
    setShowPicker(false);
  };

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (event.type === "dismissed" || !selectedDate) {
      return;
    }

    if (Platform.OS === "ios") {
      setDraftDate(selectedDate);
      return;
    }

    onChange(formatDate(selectedDate));
  };

  const confirmDate = () => {
    onChange(formatDate(draftDate));
    closePicker();
  };

  return (
    <SectionCard>
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">
        Date of Birth - DD/MM/YYYY
      </Text>
      <Pressable
        onPress={openPicker}
        className="rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10dd] px-4 py-3 text-[#fff2d1]"
      >
        <Text className={value ? "text-[#fff2d1]" : "text-[#a6906f]"}>
          {value || "DD/MM/YYYY"}
        </Text>
      </Pressable>

      {showPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseDate(value)}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleChange}
        />
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={showPicker && Platform.OS === "ios"}
        onRequestClose={closePicker}
      >
        <View className="flex-1 items-center justify-end bg-black/50 px-4 pb-10">
          <View className="w-full rounded-3xl border border-[#f3c66e3f] bg-[#180b10] p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Pressable onPress={closePicker}>
                <Text className="text-sm font-semibold text-[#d8c39a]">
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={confirmDate}>
                <Text className="text-sm font-semibold text-[#f5cf87]">
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftDate}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={handleChange}
            />
          </View>
        </View>
      </Modal>

      {error ? (
        <Text className="mt-1 text-xs text-[#ff9090]">{error}</Text>
      ) : null}
    </SectionCard>
  );
}
