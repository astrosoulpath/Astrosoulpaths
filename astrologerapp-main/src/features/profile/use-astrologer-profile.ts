import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchAstrologerProfile,
  updateAstrologerProfile,
} from "@/src/features/profile/profile.api";
import { AstrologerProfileFormValues } from "@/src/features/profile/profile.schema";

const astrologerProfileKey = ["astrologer-profile"];

export function useAstrologerProfileQuery() {
  return useQuery({
    queryFn: fetchAstrologerProfile,
    queryKey: astrologerProfileKey,
  });
}

export function useUpdateAstrologerProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAstrologerProfile,
    onSuccess: (profile: AstrologerProfileFormValues) => {
      queryClient.setQueryData(astrologerProfileKey, profile);
    },
  });
}
