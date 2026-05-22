import { render, screen } from "@testing-library/react";
import SignupPage from "../page";

jest.mock("@/app/auth/actions", () => ({
  signUp: jest.fn(),
}));

async function renderSignupPage(params: { error?: string } = {}) {
  const ui = await SignupPage({ searchParams: Promise.resolve(params) });
  render(ui);
}

describe("SignupPage", () => {
  it("renders email and password fields and submit button", async () => {
    await renderSignupPage();

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeInTheDocument();
  });

  it("renders a link back to the login page", async () => {
    await renderSignupPage();

    const link = screen.getByRole("link", { name: /inicia sesión/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("shows error banner when error param is present", async () => {
    await renderSignupPage({ error: "User already registered" });

    expect(screen.getByText("User already registered")).toBeInTheDocument();
  });

  it("does not show error banner when no error param", async () => {
    await renderSignupPage();

    expect(screen.queryByText(/registered/i)).not.toBeInTheDocument();
  });

  it("password input enforces minLength of 6", async () => {
    await renderSignupPage();

    const passwordInput = screen.getByLabelText(/contraseña/i);
    expect(passwordInput).toHaveAttribute("minlength", "6");
    expect(passwordInput).toHaveAttribute("autocomplete", "new-password");
  });

  it("email input is required", async () => {
    await renderSignupPage();

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    expect(emailInput).toBeRequired();
  });
});
