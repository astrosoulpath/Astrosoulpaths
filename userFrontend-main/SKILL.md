# React Native/Expo Production Mobile Development Skill

## Purpose

Establish scalable, maintainable, and production-ready React Native (Expo) applications with consistent architecture, premium UI/UX, and enterprise-grade standards. This skill ensures every feature is built for scale from day one.

## When to Use This Skill

- **Creating new features** for the AstroFrontend mobile app
- **Building UI components** that need consistency across platforms
- **Setting up authentication flows** or user-facing screens
- **Implementing API integration** layers
- **Establishing state management** for features
- **Validating user input** and handling errors
- **Debugging production issues** or refactoring existing code
- **Onboarding developers** to the project standards
- **Code review** to ensure quality alignment

**Scope:** AstroFrontend Frontend mobile application (React Native + Expo + TypeScript)

---

## Core Tech Stack

- **Framework:** React Native (Expo)
- **Language:** TypeScript (strict mode, strong typing everywhere)
- **Routing:** Expo Router (file-based routing)
- **Styling:** NativeWind + Tailwind CSS
- **UI Components:** Gluestack UI
- **HTTP Client:** Axios with interceptors
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Form Management:** React Hook Form
- **Validation:** Zod
- **Secure Storage:** Expo Secure Store
- **Authentication:** OTP-based (phone number)

---

## Folder Structure Standard

Every feature must follow this clean architecture pattern:

```
features/
 ├─ [feature-name]/
 │  ├─ api/
 │  │  ├─ [feature].api.ts       # API endpoints & queries
 │  │  └─ [feature].types.ts     # API response/request types
 │  ├─ components/
 │  │  ├─ [Component].tsx        # Feature-specific components
 │  │  └─ index.ts               # Barrel exports
 │  ├─ hooks/
 │  │  ├─ use[Action].ts         # Feature hooks (mutations, effects)
 │  │  └─ index.ts               # Barrel exports
 │  ├─ schemas/
 │  │  └─ [feature].schemas.ts   # Zod validation schemas
 │  ├─ screens/
 │  │  ├─ [Screen].tsx           # Full-screen components
 │  │  └─ index.ts               # Exports
 │  ├─ store/
 │  │  ├─ [feature].store.ts     # Zustand store
 │  │  └─ [feature].storage.ts   # Persistent storage config
 │  ├─ types/
 │  │  └─ [feature].types.ts     # Business logic types
 │  ├─ utils/
 │  │  ├─ [helper].ts            # Feature utilities
 │  │  └─ index.ts               # Barrel exports
 │  └─ index.ts                  # Feature barrel export

components/
 ├─ ui/                          # Reusable UI building blocks
 ├─ custom/                      # Custom business components
 └─ [category]/                  # Organized by domain

lib/
 ├─ api/
 │  └─ axios.ts                  # Axios instance & interceptors
 ├─ query/
 │  └─ query-client.ts           # TanStack Query configuration
 ├─ supabase/
 │  └─ client.ts                 # Supabase client setup
 └─ [lib-name]/

app/
 ├─ (auth)/                      # Auth feature routes
 ├─ (tabs)/                      # Authenticated routes
 └─ _layout.tsx                  # Root layout
```

---

## Architecture Principles

### 1. **Clean Architecture (Layered)**

- **Presentation:** Components, screens, hooks
- **Business Logic:** API calls, Zustand store, validation
- **Data:** Axios, Supabase, Secure Store
- **Separation of concerns:** No UI logic in API layer, no API calls in components

### 2. **Dependency Inversion**

- Components depend on hooks, not direct API calls
- Hooks depend on Zustand + TanStack Query
- Store depends on axios/supabase client
- Direction: UI → Hooks → Store → API → Services

### 3. **No Shortcuts**

- Every feature must be complete before moving to next
- No temporary `TODO` comments for production code
- No hardcoded values or magic strings
- All environment configs must be in proper files
- Future-proof role-based access control from day one

### 4. **Strong Typing**

```typescript
// ✅ DO: Explicit types everywhere
interface UserProfile {
  id: string;
  phone: string;
  email?: string;
  createdAt: Date;
}

type AuthState = {
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
};

// ❌ DON'T: Implicit `any` types
const user: any = response.data;
```

### 5. **Modular & Reusable**

- Extract common logic into utils
- Create custom hooks for stateful logic
- Build UI components that work across the app
- Each function has single responsibility

---

## Non-Negotiable Senior-Grade Standards

These are absolute requirements. There are no exceptions.

### Code Quality Absolutes

❌ **Do NOT generate placeholder code** - Every line shipped must be production-complete
❌ **Do NOT leave incomplete TODO implementations** - Finish or don't start
❌ **Do NOT skip edge case handling** - Plan for failure scenarios upfront
❌ **Do NOT use inconsistent naming conventions** - Follow camelCase for variables, PascalCase for components
❌ **Do NOT bypass loading/error states** - Every async operation must show loading and handle errors
❌ **Do NOT mix business logic inside UI components** - Extract to hooks and stores immediately

### Architectural Absolutes

✅ **Always maintain SOLID principles:**

- **S**ingle Responsibility: Each module does one thing well
- **O**pen/Closed: Open for extension, closed for modification
- **L**iskov Substitution: Derived types must be substitutable
- **I**nterface Segregation: Don't depend on unused interfaces
- **D**ependency Inversion: Depend on abstractions, not concretions

✅ **Always optimize for maintainability over speed** - Code written at 3am for speed becomes technical debt at 9am
✅ **Always use reusable design tokens** - Colors, spacing, typography from centralized configuration
✅ **Always ensure future API extensibility** - Assume the API will change; structure to absorb changes gracefully

---

## Implementation Workflow

### Step 1: Plan the Feature Architecture

**Goal:** Define feature scope before coding

1. **Identify feature requirements:**
   - What screens does it need?
   - What API endpoints?
   - What state must persist?
   - What validation rules?
   - What error scenarios?

2. **Sketch the data flow:**
   - User action → Hook → Store mutation → API call
   - API response → Store update → Component re-render
   - Error handling → Error state → Error UI

3. **Identify reusable components:**
   - Will other features use similar UI?
   - Can validation be shared?
   - Are there common patterns?

**Example Planning (Auth Feature):**

```
Screens: SendOtpScreen, VerifyOtpScreen
APIs: sendOtp, verifyOtp, logout
Store: auth.store (user, token, isLoading, error)
Hooks: useSendOtp, useVerifyOtp, useLogout
Validation: phoneSchema, otpSchema
Components: OtpCodeInput, OtpSubmitButton
```

### Step 2: Create Types & Schemas

**Goal:** Strong typing foundation

1. **Create API types** (`features/[feature]/api/[feature].types.ts`):

```typescript
// Request/Response types from API docs
export interface SendOtpRequest {
  phone: string;
}

export interface SendOtpResponse {
  success: boolean;
  message: string;
  expiresIn: number; // seconds
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    phone: string;
  };
}
```

2. **Create validation schemas** (`features/[feature]/schemas/[feature].schemas.ts`):

```typescript
import { z } from "zod";

export const phoneSchema = z
  .string()
  .min(10, "Phone must be at least 10 digits")
  .regex(/^\d+$/, "Phone must contain only digits")
  .transform((val) => val.replace(/[^\d]/g, ""));

export const otpSchema = z
  .string()
  .length(6, "OTP must be 6 digits")
  .regex(/^\d+$/, "OTP must contain only digits");

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});

export type SendOtpFormData = z.infer<typeof sendOtpSchema>;
export type VerifyOtpFormData = z.infer<typeof verifyOtpSchema>;
```

3. **Create business types** (`features/[feature]/types/[feature].types.ts`):

```typescript
export interface User {
  id: string;
  phone: string;
  email?: string;
  createdAt: Date;
  role: "user" | "admin";
}

export type AuthStatus =
  | "unauthenticated"
  | "authenticating"
  | "authenticated"
  | "error";
```

### Step 3: Create API Layer

**Goal:** Centralized, typed API management

1. **Create API client** (`features/[feature]/api/[feature].api.ts`):

```typescript
import axios from "@/lib/api/axios";
import type {
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "./auth.types";

const AUTH_BASE = "/auth"; // Use environment variable for production

export const authApi = {
  async sendOtp(data: SendOtpRequest): Promise<SendOtpResponse> {
    const response = await axios.post<SendOtpResponse>(
      `${AUTH_BASE}/send-otp`,
      data,
    );
    return response.data;
  },

  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const response = await axios.post<VerifyOtpResponse>(
      `${AUTH_BASE}/verify-otp`,
      data,
    );
    return response.data;
  },

  async refreshToken(): Promise<{ token: string }> {
    const response = await axios.post<{ token: string }>(
      `${AUTH_BASE}/refresh`,
    );
    return response.data;
  },
};
```

2. **Configure Axios interceptors** (`lib/api/axios.ts`):

```typescript
import axios from "axios";
import { authStore } from "@/features/auth/store/auth.store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const instance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
  timeout: 10000,
});

// Request interceptor: Add auth token
instance.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: Handle 401, refresh token
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Trigger token refresh or logout
      authStore.setState({ isAuthenticated: false });
    }
    return Promise.reject(error);
  },
);

export default instance;
```

### Step 4: Create State Management (Zustand Store)

**Goal:** Centralized, predictable state

```typescript
// features/auth/store/auth.store.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User, AuthStatus } from "../types/auth.types";

interface AuthState {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  token: null,
  status: "unauthenticated" as AuthStatus,
  error: null,
};

export const authStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error }),
      reset: () => set(initialState),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }), // Only persist token and user
    },
  ),
);
```

### Step 5: Create Custom Hooks

**Goal:** Encapsulate business logic, reusable across screens

```typescript
// features/auth/hooks/useSendOtp.ts
import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api/auth.api";
import { authStore } from "../store/auth.store";
import type { SendOtpFormData } from "../schemas/auth.schemas";

export function useSendOtp() {
  const mutation = useMutation({
    mutationFn: async (data: SendOtpFormData) => {
      authStore.setState({ status: "authenticating", error: null });
      return authApi.sendOtp({ phone: data.phone });
    },
    onSuccess: (data) => {
      authStore.setState({
        status: "authenticating",
        error: null,
      });
      // Store OTP expiry for UI countdown
      return data;
    },
    onError: (error: Error) => {
      authStore.setState({
        status: "error",
        error: error.message || "Failed to send OTP",
      });
    },
  });

  return mutation;
}

// features/auth/hooks/useVerifyOtp.ts
export function useVerifyOtp() {
  const mutation = useMutation({
    mutationFn: async (data: VerifyOtpFormData) => {
      authStore.setState({ status: "authenticating", error: null });
      return authApi.verifyOtp(data);
    },
    onSuccess: (data) => {
      authStore.setState({
        token: data.token,
        user: data.user,
        status: "authenticated",
        error: null,
      });
    },
    onError: (error: Error) => {
      authStore.setState({
        status: "error",
        error: error.message || "Failed to verify OTP",
      });
    },
  });

  return mutation;
}

// features/auth/hooks/useLogout.ts
export function useLogout() {
  return () => {
    authStore.setState({
      user: null,
      token: null,
      status: "unauthenticated",
      error: null,
    });
    // Additional cleanup if needed
  };
}
```

### Step 6: Create UI Components

**Goal:** Reusable, consistent, accessible UI

1. **Reusable UI building blocks** (`components/ui/`):
   - Button variations (primary, secondary, danger)
   - Input fields with error states
   - Loading indicators
   - Error banners

2. **Feature-specific components** (`features/[feature]/components/`):

```typescript
// features/auth/components/OtpCodeInput.tsx
import React from 'react';
import { useController, FieldValues } from 'react-hook-form';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { VStack } from '@/components/ui/vstack';

interface OtpCodeInputProps<T extends FieldValues> {
  control: any;
  name: string;
  label: string;
  error?: string;
  disabled?: boolean;
}

export function OtpCodeInput<T extends FieldValues>({
  control,
  name,
  label,
  error,
  disabled,
}: OtpCodeInputProps<T>) {
  const { field } = useController({ control, name });

  return (
    <VStack space="sm">
      <Text size="sm" weight="bold">
        {label}
      </Text>
      <Input
        {...field}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        editable={!disabled}
        disabled={disabled}
      />
      {error && (
        <Text size="xs" color="error">
          {error}
        </Text>
      )}
    </VStack>
  );
}
```

### Step 7: Create Screens

**Goal:** Full-screen user interfaces with integrated logic

```typescript
// features/auth/screens/SendOtpScreen.tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { VStack } from '@/components/ui/vstack';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { sendOtpSchema, type SendOtpFormData } from '../schemas/auth.schemas';
import { useSendOtp } from '../hooks/useSendOtp';
import { PhoneInput } from '../components/PhoneInput';

export function SendOtpScreen() {
  const sendOtpMutation = useSendOtp();
  const { control, handleSubmit, formState: { errors } } = useForm<SendOtpFormData>({
    resolver: zodResolver(sendOtpSchema),
    defaultValues: { phone: '' },
  });

  const onSubmit = (data: SendOtpFormData) => {
    sendOtpMutation.mutate(data);
  };

  const { error, isPending } = sendOtpMutation;

  return (
    <VStack space="lg" className="p-6 flex-1 justify-center">
      <Text size="lg" weight="bold">
        Enter Your Phone
      </Text>

      <PhoneInput
        control={control}
        name="phone"
        error={errors.phone?.message}
      />

      {error && (
        <Text className="text-red-500 text-center">
          {error.message}
        </Text>
      )}

      <Button
        onPress={handleSubmit(onSubmit)}
        disabled={isPending}
        isLoading={isPending}
      >
        Send OTP
      </Button>
    </VStack>
  );
}
```

### Step 8: Handle Errors & Edge Cases

**Goal:** Robust, user-friendly error handling

1. **Network errors:**
   - Timeout
   - No internet
   - Server down

2. **Validation errors:**
   - Show below field
   - Use consistent red styling
   - Clear, actionable messages

3. **API errors:**
   - Rate limiting (show retry timer)
   - Invalid credentials
   - Server errors (retry logic)

```typescript
// Example error handling
const handleError = (error: AxiosError) => {
  if (!error.response) {
    return "No internet connection. Please try again.";
  }

  switch (error.response.status) {
    case 400:
      return "Invalid input. Please check and try again.";
    case 401:
      return "Session expired. Please log in again.";
    case 429:
      return "Too many attempts. Please try again later.";
    case 500:
      return "Server error. Please try again later.";
    default:
      return "Something went wrong. Please try again.";
  }
};
```

### Step 9: Test & Debug

**Goal:** Production-ready reliability

1. **Manual testing:**
   - Happy path (success flow)
   - Error cases (invalid input, network errors)
   - Edge cases (rapid clicks, network interruption mid-request)
   - Cross-platform (iOS, Android, web if applicable)

2. **Debugging:**
   - Use React Native Debugger / Expo DevTools
   - Check console logs with feature prefix: `[Auth]`, `[API]`
   - Verify Zustand store state changes
   - Monitor Axios request/response

```typescript
// Add debug logging
console.log("[Auth] Sending OTP for phone:", phone);
console.log("[Auth] OTP verification response:", response);
console.log("[Store] Auth state updated:", authStore.getState());
```

### Step 10: Document & Deploy

**Goal:** Maintainable, handoff-ready code

1. **Code comments:**
   - Why, not what (why this validation rule exists)
   - Complex logic explanations
   - Non-obvious patterns

2. **Type documentation:**
   - JSDoc comments for public functions
   - Explain union types and decision points

3. **README in feature folder:**
   - Feature overview
   - How to use the hooks
   - Common patterns

---

## UI/UX Standards

### Premium Spacing Rhythm

- **Maintain consistent spacing scale:** `xs` (4px), `sm` (8px), `md` (16px), `lg` (24px), `xl` (32px)
- **Never break rhythm** - All spacing must align to this scale
- **Mobile-first premium design** - Design for smallest screen first, then scale up gracefully
- **Prevent layout shift** - Define sizes upfront to avoid CLS (Cumulative Layout Shift)

### Colors & Design Tokens

- Use Tailwind CSS utilities consistently
- **Centralize all design tokens** - Colors, shadows, border radius in Tailwind config
- Consistent button sizing across all screens
- **Ensure pixel-consistent layouts** - Use fixed widths/heights for buttons, inputs, spacing

### Animation Consistency

- **Maintain animation timing** - Use consistent duration (200ms-400ms for UI transitions)
- **Prevent janky animations** - Use transform/opacity, avoid layout-triggering properties
- **Document animation patterns** - Loading spinners, transitions, state changes must be predictable

### Validation Error Display

```typescript
// ✅ DO: Consistent error display
<VStack space="sm">
  <Input {...field} />
  {error && (
    <Text size="xs" className="text-red-500">
      {error.message}
    </Text>
  )}
</VStack>

// ❌ DON'T: Inconsistent error handling
{error && <Text>{error}</Text>}
```

### Loading States

- Show loading spinner/indicator
- Disable form fields while loading
- Show loading state on buttons

### Disabled States

- Gray out disabled buttons
- Disable interactions on forms during submission
- Clear visual feedback

### Accessibility

- Proper label associations
- Readable text contrast (WCAG AA minimum)
- Touch targets ≥ 44x44pt minimum
- Keyboard navigation support on all interactive elements
- Screen reader compatibility for critical flows

---

## Security Standards

### Token & Credential Management

❌ **Never expose tokens in logs**

```typescript
// ❌ DON'T: Token exposed in console
console.log("Token:", authToken);
logger.info("User authenticated with token", { token });

// ✅ DO: Token hidden from logs
console.log("Token saved successfully");
logger.info("User authenticated", { userId: user.id });
```

✅ **Always sanitize sensitive API errors**

```typescript
// ❌ DON'T: Raw API error exposed
if (error.response?.data?.message) {
  setError(error.response.data.message); // Might contain sensitive info
}

// ✅ DO: Sanitized user-friendly error
const sanitizedError = getSanitizedErrorMessage(error);
setError(sanitizedError); // "Authentication failed. Please try again."
```

✅ **Always use secure token persistence**

- Use **Expo Secure Store** for sensitive tokens (not AsyncStorage)
- Never store tokens in Redux/Zustand state alone
- Implement token encryption for sensitive data
- Auto-clear tokens on logout

```typescript
// ✅ Secure storage pattern
import * as SecureStore from "expo-secure-store";

export const secureTokenStore = {
  async setToken(token: string) {
    await SecureStore.setItemAsync("auth_token", token);
  },
  async getToken() {
    return await SecureStore.getItemAsync("auth_token");
  },
  async clearToken() {
    await SecureStore.deleteItemAsync("auth_token");
  },
};
```

✅ **Always prepare refresh token workflows**

- Implement token expiry detection
- Auto-refresh before expiry (not after)
- Handle refresh failures gracefully (force logout)
- Prevent race conditions in refresh

```typescript
// ✅ Refresh token workflow
instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { token } = await authApi.refreshToken();
        await secureTokenStore.setToken(token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return instance(originalRequest);
      } catch (refreshError) {
        authStore.setState({ status: "unauthenticated", token: null });
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
```

✅ **Always prevent race conditions in auth flows**

- Use mutation flags to prevent duplicate requests
- Queue auth mutations while one is in progress
- Lock state during critical operations

```typescript
// ✅ Prevent duplicate auth requests
const authLock = { isLocked: false };

export function useVerifyOtp() {
  return useMutation({
    mutationFn: async (data) => {
      if (authLock.isLocked) return; // Prevent race condition
      authLock.isLocked = true;
      try {
        authStore.setState({ status: "authenticating" });
        return await authApi.verifyOtp(data);
      } finally {
        authLock.isLocked = false;
      }
    },
  });
}
```

---

## Performance Standards

### Render Optimization

✅ **Minimize unnecessary re-renders**

- Use React.memo for expensive components
- Verify hook dependencies with ESLint exhaustive-deps
- Avoid creating new objects/arrays in renders

```typescript
// ✅ Memoized component to prevent unnecessary re-renders
const OtpInput = React.memo(({ value, onChange }) => {
  return <Input value={value} onChangeText={onChange} />;
});

// ✅ Stable callback references
const handleSubmit = useCallback((data) => {
  mutation.mutate(data);
}, [mutation]);
```

✅ **Use memoization where appropriate**

- Memoize computed values: `useMemo`
- Memoize callbacks: `useCallback`
- Memoize components: `React.memo`
- Profile before and after (don't over-optimize)

✅ **Optimize query invalidation**

- Invalidate only affected queries
- Use query scopes/tags for targeted invalidation
- Avoid blanket `queryClient.clear()`

```typescript
// ✅ Targeted invalidation
queryClient.invalidateQueries({
  queryKey: ["user", userId],
  exact: true,
});

// ❌ DON'T: Nuclear option
queryClient.clear();
```

✅ **Prevent duplicate API calls**

- Cache GET requests aggressively
- Use request deduplication
- Implement request batching for multiple related calls

```typescript
// ✅ Automatic deduplication with React Query
const query = useQuery({
  queryKey: ["profile", userId],
  queryFn: () => profileApi.getProfile(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

✅ **Design for low-end device performance**

- Test on low-spec Android devices
- Lazy-load images and heavy components
- Minimize bundle size
- Debounce search/filter inputs

```typescript
// ✅ Debounce expensive operations
const debouncedSearch = useMemo(
  () =>
    debounce((term: string) => {
      searchMutation.mutate(term);
    }, 300),
  [],
);
```

---

## Authentication Workflow

### Initial Setup

1. **Hydrate on app launch:**
   - Check if token exists in Secure Store
   - If yes, verify token validity
   - Redirect to home or login accordingly

2. **Login flow:**
   - Phone input validation (Zod)
   - Send OTP via API
   - Show OTP verification screen
   - Verify OTP
   - Store token securely
   - Update auth state
   - Redirect to home

3. **Session persistence:**
   - Store token in Secure Store (not AsyncStorage for sensitive data)
   - Auto-refresh token before expiry
   - Clear on logout

```typescript
// Hydration hook
export function useAuthHydration() {
  const hydrateMutation = useMutation({
    mutationFn: async () => {
      const token = await secureStore.getItem("auth_token");
      if (token) {
        // Verify token is still valid
        const user = await authApi.getMe();
        return { token, user };
      }
      return null;
    },
    onSuccess: (data) => {
      if (data) {
        authStore.setState({
          token: data.token,
          user: data.user,
          status: "authenticated",
        });
      }
    },
  });

  useEffect(() => {
    hydrateMutation.mutate();
  }, []);

  return hydrateMutation;
}
```

---

## Debugging Checklist

- [ ] Console logs show action flow
- [ ] Zustand store state changes logged
- [ ] API requests/responses visible in network tab
- [ ] Validation errors clear and actionable
- [ ] Error states handled gracefully
- [ ] Loading states visible to user
- [ ] No hardcoded values in code
- [ ] All types are strong/non-any
- [ ] Components are reusable
- [ ] No tightly coupled code
- [ ] Code is maintainable by new developer

---

## Code Review Checklist

**Architecture:**

- [ ] Follows feature-first folder structure
- [ ] Clean separation of concerns
- [ ] No business logic in components
- [ ] API calls only in hooks/stores
- [ ] SOLID principles maintained
- [ ] Future extensibility considered

**Typing:**

- [ ] No `any` types
- [ ] All props properly typed
- [ ] API responses typed
- [ ] Store state typed
- [ ] Union types documented

**Validation:**

- [ ] Uses Zod schemas
- [ ] React Hook Form integrated
- [ ] Error messages user-friendly
- [ ] Server validation handled
- [ ] Edge cases covered

**Security:**

- [ ] No tokens in logs
- [ ] Sensitive errors sanitized
- [ ] Secure token storage used
- [ ] Refresh token workflow implemented
- [ ] Race conditions prevented
- [ ] No hardcoded credentials

**UI/UX:**

- [ ] Consistent with design system
- [ ] Proper spacing and alignment
- [ ] Loading indicators present
- [ ] Error states handled
- [ ] Accessibility considered
- [ ] Animations consistent
- [ ] No layout shift
- [ ] Premium spacing rhythm maintained

**Performance:**

- [ ] No unnecessary re-renders
- [ ] Proper hook dependencies
- [ ] Efficient API calls
- [ ] No memory leaks
- [ ] Memoization applied where needed
- [ ] No duplicate API calls
- [ ] Tested on low-end devices

**Completeness:**

- [ ] No placeholder code
- [ ] All TODOs resolved
- [ ] Edge cases handled
- [ ] Naming conventions consistent
- [ ] Loading/error states present

**Maintainability:**

- [ ] Clear variable/function names
- [ ] Comments where needed
- [ ] Reusable patterns
- [ ] Easy to debug
- [ ] Design tokens used
- [ ] Code follows existing patterns

---

## Related Workflows & Skills

1. **Mobile Component Library Development** - Building reusable Gluestack components
2. **API Integration Patterns** - Advanced Axios & TanStack Query setups
3. **State Management Scaling** - Multi-store Zustand architecture for large apps
4. **React Native Debugging** - Production logging & error tracking
5. **TypeScript Best Practices** - Advanced typing patterns for React Native
6. **Testing Strategy** - Unit, integration, E2E for React Native apps

---

## Common Gotchas & Solutions

| Issue                            | Cause                     | Solution                                          |
| -------------------------------- | ------------------------- | ------------------------------------------------- |
| Token not included in request    | Axios interceptor not set | Verify `lib/api/axios.ts` has request interceptor |
| Component re-renders excessively | Missing hook dependencies | Use ESLint rule `exhaustive-deps`                 |
| TypeScript errors with generics  | Incomplete type inference | Explicitly type generic parameters                |
| AsyncStorage blocking app        | Using for secure data     | Use Expo Secure Store for auth tokens             |
| Validation not triggering        | Zod resolver not wired    | Verify `zodResolver` in `useForm`                 |
| Screen appears blank             | Store not hydrated        | Add loading state during hydration                |

---

## Quick Start for New Feature

1. **Create folder structure** under `features/[feature-name]/`
2. **Define types** in `types/` and schemas in `schemas/`
3. **Create API client** in `api/`
4. **Set up Zustand store** in `store/`
5. **Build custom hooks** in `hooks/`
6. **Create reusable components** in `components/`
7. **Build screens** in `screens/`
8. **Test all flows** (happy path + error cases)
9. **Code review** against this skill's standards
10. **Deploy** with confidence

---

## Example Prompts to Try This Skill

- "Add a profile editing feature following our mobile development standards"
- "Create a notifications screen with pull-to-refresh using our architecture"
- "Implement a settings panel with toggle switches and persistence"
- "Build an in-app purchase flow with validation and error handling"
- "Add a search feature with debouncing and API integration"
- "Create a favorites list with local caching and sync"

---

## Success Criteria

A feature following this skill is production-ready when:

✅ **All types are strong** - No `any` types, full TypeScript coverage
✅ **Architecture is clean** - Separation of concerns, modular, reusable
✅ **Validation is robust** - Zod schemas, clear error messages
✅ **UI is consistent** - Matches design system, responsive, accessible
✅ **Error handling is comprehensive** - Network, validation, server errors handled
✅ **Code is debuggable** - Clear logging, easy to trace issues
✅ **Performance is optimized** - No unnecessary renders, efficient API calls
✅ **Documentation exists** - Clear comments, types documented
✅ **Manual testing passed** - Happy path + error cases + edge cases
✅ **Code review approved** - Team approves against standards

---

## Version & Maintenance

**Current Version:** 1.0  
**Last Updated:** May 2, 2026  
**Maintained by:** Senior React Native Architect  
**Review Frequency:** Quarterly or as needed with framework updates

---
