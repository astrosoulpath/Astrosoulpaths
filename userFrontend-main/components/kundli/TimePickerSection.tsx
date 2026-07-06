import { Text } from "@/components/ui/text";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { SectionCard } from "./SectionCard";

type TimePickerSectionProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const parsed = new Date();

  if (Number.isInteger(hours) && Number.isInteger(minutes)) {
    parsed.setHours(hours, minutes, 0, 0);
  }

  return parsed;
}

export function TimePickerSection({
  value,
  onChange,
  error,
}: TimePickerSectionProps) {
  const [showPicker, setShowPicker] = React.useState(false);
  const [draftTime, setDraftTime] = React.useState(() => parseTime(value));

  const openPicker = () => {
    setDraftTime(parseTime(value));
    setShowPicker(true);
  };

  const closePicker = () => {
    setShowPicker(false);
  };

  const handleChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }

    if (event.type === "dismissed" || !selectedTime) {
      return;
    }

    if (Platform.OS === "ios") {
      setDraftTime(selectedTime);
      return;
    }

    onChange(formatTime(selectedTime));
  };

  const confirmTime = () => {
    onChange(formatTime(draftTime));
    closePicker();
  };

  return (
    <SectionCard>
      <Text className="mb-2 text-sm font-semibold text-[#f5cf87]">
        Time of Birth in Hours - HH:MM
      </Text>
      <Pressable
        onPress={openPicker}
        className="rounded-2xl border border-[#f3c66e3f] bg-[#1a0d10dd] px-4 py-3 text-[#fff2d1]"
      >
        <Text className={value ? "text-[#fff2d1]" : "text-[#a6906f]"}>
          {value || "HH:MM"}
        </Text>
      </Pressable>

      {showPicker && Platform.OS === "android" ? (
        <DateTimePicker
          value={parseTime(value)}
          mode="time"
          display="default"
          is24Hour
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
              <Pressable onPress={confirmTime}>
                <Text className="text-sm font-semibold text-[#f5cf87]">
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={draftTime}
              mode="time"
              display="spinner"
              is24Hour
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
