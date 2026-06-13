import { render, screen } from "@testing-library/react";
import LoginPage from "../page";

jest.mock("@/app/auth/actions", () => ({
  signIn: jest.fn(),
}));

async function renderLoginPage(params: { error?: string; message?: string } = {}) {
  const ui = await LoginPage({ searchParams: Promise.resolve(params) });
  render(ui);
}

describe("LoginPage", () => {
  it("renders email and password fields and submit button", async () => {
    await renderLoginPage();

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/contraseña/i, { selector: "input" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("does not offer public signup (accounts are admin-provisioned)", async () => {
    await renderLoginPage();

    expect(screen.queryByRole("link", { name: /regístrate/i })).not.toBeInTheDocument();
    expect(screen.getByText(/contacta al administrador/i)).toBeInTheDocument();
  });

  it("shows error banner when error param is present", async () => {
    await renderLoginPage({ error: "Invalid credentials" });

    expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
  });

  it("shows success message banner when message param is present", async () => {
    await renderLoginPage({ message: "Check your email to confirm your account" });

    expect(
      screen.getByText("Check your email to confirm your account")
    ).toBeInTheDocument();
  });

  it("does not show banners when no params are present", async () => {
    await renderLoginPage();

    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
  });

  it("email input has correct type and autocomplete", async () => {
    await renderLoginPage();

    const emailInput = screen.getByLabelText(/correo electrónico/i);
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("autocomplete", "email");
  });

  it("password input has correct type and autocomplete", async () => {
    await renderLoginPage();

    const passwordInput = screen.getByLabelText(/contraseña/i, {
      selector: "input",
    });
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
  });

  it("offers a toggle to show the password while typing", async () => {
    await renderLoginPage();

    expect(
      screen.getByRole("button", { name: /mostrar contraseña/i })
    ).toBeInTheDocument();
  });
});
