import { Controller, Control } from "react-hook-form";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/ui/text";
import {
  AstrologerProfileFormValues,
  expertiseOptions,
} from "@/src/features/profile/profile.schema";

type ExpertiseTagsFieldProps = {
  control: Control<AstrologerProfileFormValues>;
};

export function ExpertiseTagsField({ control }: ExpertiseTagsFieldProps) {
  return (
    <Controller
      control={control}
      name="expertise"
      render={({ field: { onChange, value }, fieldState }) => {
        const selected = value ?? [];

        const toggleTag = (tag: string) => {
          if (selected.includes(tag)) {
            onChange(selected.filter((item) => item !== tag));
            return;
          }

          if (selected.length < 8) {
            onChange([...selected, tag]);
          }
        };

        return (
          <View style={styles.root}>
            <Text style={styles.title}>My Expertise</Text>
            <Text style={styles.hint}>(Add up to 8 tags)</Text>
            <View style={styles.tags}>
              {expertiseOptions.map((tag) => {
                const active = selected.includes(tag);

                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[styles.tag, active && styles.tagActive]}
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>
                      {tag}
                    </Text>
                    {active ? <Text style={styles.remove}>x</Text> : null}
                  </Pressable>
                );
              })}
            </View>
            {fieldState.error ? (
              <Text style={styles.error}>{fieldState.error.message}</Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 6,
  },
  title: {
    color: "#F0B35D",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  hint: {
    color: "#8E98CA",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: -14,
    marginLeft: 86,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 11,
  },
  tag: {
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(126,145,203,0.24)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    backgroundColor: "rgba(9,18,44,0.72)",
  },
  tagActive: {
    borderColor: "rgba(212,167,87,0.35)",
    backgroundColor: "rgba(36, 43, 91, 0.76)",
  },
  tagText: {
    color: "#D7DAF0",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  tagTextActive: {
    color: "#F0B35D",
  },
  remove: {
    color: "#B6B8D6",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 6,
  },
});
