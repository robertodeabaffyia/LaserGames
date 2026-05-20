import { signIn, signUp, signOut } from "../actions";

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
      },
    })
  ),
}));

const mockRedirect = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

jest.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => mockRevalidatePath(path, type),
}));

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signIn", () => {
  it("redirects to /dashboard on success", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });

    await expect(
      signIn(makeFormData({ email: "user@test.com", password: "secret" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "secret",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects to /login with encoded error on failure", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid credentials" },
    });

    await expect(
      signIn(makeFormData({ email: "user@test.com", password: "wrong" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      "/login?error=Invalid%20credentials"
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("signUp", () => {
  it("redirects to /login with confirmation message on success", async () => {
    mockSignUp.mockResolvedValue({ error: null });

    await expect(
      signUp(makeFormData({ email: "new@test.com", password: "password123" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignUp).toHaveBeenCalledWith({
      email: "new@test.com",
      password: "password123",
    });
    expect(mockRedirect).toHaveBeenCalledWith(
      "/login?message=Check your email to confirm your account"
    );
  });

  it("redirects to /signup with encoded error on failure", async () => {
    mockSignUp.mockResolvedValue({
      error: { message: "User already registered" },
    });

    await expect(
      signUp(makeFormData({ email: "existing@test.com", password: "pass" }))
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith(
      "/signup?error=User%20already%20registered"
    );
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and redirects to /login", async () => {
    mockSignOut.mockResolvedValue({});

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
