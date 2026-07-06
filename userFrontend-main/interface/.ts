export interface AuthState {
  phone: string;
  user: any;
  session: any;
  isAuthenticated: boolean;
  isLoading: boolean;

  setPhone: (phone: string) => void;
  setUser: (user: any) => void;
  setSession: (session: any) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}
