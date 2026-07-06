import { LucideIcon } from "lucide-react-native";
import { Controller, Control, FieldPath } from "react-hook-form";
import { StyleSheet, TextInputProps, View } from "react-native";

import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelAstrick,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { AstrologerProfileFormValues } from "@/src/features/profile/profile.schema";

type ProfileFieldProps = TextInputProps & {
  control: Control<AstrologerProfileFormValues>;
  icon: LucideIcon;
  label: string;
  name: FieldPath<AstrologerProfileFormValues>;
  required?: boolean;
};

export function ProfileField({
  control,
  icon: Icon,
  label,
  name,
  required = true,
  ...inputProps
}: ProfileFieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onBlur, onChange, value }, fieldState }) => (
        <FormControl isInvalid={!!fieldState.error} style={styles.control}>
          <FormControlLabel style={styles.labelRow}>
            <FormControlLabelText style={styles.label}>
              {label}
            </FormControlLabelText>
            {required ? (
              <FormControlLabelAstrick style={styles.required}>
                *
              </FormControlLabelAstrick>
            ) : null}
          </FormControlLabel>

          <Input style={styles.input} size="xl">
            <HStack style={styles.inner}>
              <Icon color="#8E98CA" size={18} strokeWidth={1.9} />
              <InputField
                {...inputProps}
                multiline={inputProps.multiline}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholderTextColor="#68729D"
                style={[
                  styles.field,
                  inputProps.multiline && styles.fieldMultiline,
                ]}
                value={Array.isArray(value) ? value.join(", ") : value}
              />
            </HStack>
            {inputProps.maxLength ? (
              <View style={styles.counterWrap}>
                <Text style={styles.counter}>
                  {String(value ?? "").length}/{inputProps.maxLength}
                </Text>
              </View>
            ) : null}
          </Input>

          {fieldState.error ? (
            <FormControlError>
              <FormControlErrorText style={styles.error}>
                {fieldState.error.message}
              </FormControlErrorText>
            </FormControlError>
          ) : null}
        </FormControl>
      )}
    />
  );
}

const styles = StyleSheet.create({
  control: {
    gap: 5,
  },
  labelRow: {
    marginBottom: 0,
  },
  label: {
    color: "#B6B8D6",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    lineHeight: 16,
  },
  required: {
    color: "#F0B35D",
    fontSize: 12,
  },
  input: {
    minHeight: 56,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(126,145,203,0.26)",
    backgroundColor: "rgba(5, 13, 34, 0.76)",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    paddingLeft: 13,
    paddingRight: 4,
  },
  field: {
    color: "#FFFFFF",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  fieldMultiline: {
    minHeight: 86,
    paddingTop: 9,
    textAlignVertical: "top",
  },
  counterWrap: {
    position: "absolute",
    bottom: 6,
    right: 10,
  },
  counter: {
    color: "#7F87B5",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
  },
  error: {
    color: "#FCA5A5",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
});
