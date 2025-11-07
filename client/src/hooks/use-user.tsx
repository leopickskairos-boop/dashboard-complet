import { useQuery } from "@tanstack/react-query";

export interface PublicUser {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
  subscriptionStatus: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  createdAt: string;
}

export function useUser() {
  const { data: user, isLoading, error } = useQuery<PublicUser>({
    queryKey: ['/api/auth/me'],
  });

  return { user, isLoading, error };
}
