import { render, screen, fireEvent } from "@testing-library/react";
import PasswordInput from "../PasswordInput";

describe("PasswordInput", () => {
  it("renders as type=password by default", () => {
    render(<PasswordInput id="pw" name="password" />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggles to type=text when the show button is clicked", () => {
    render(<PasswordInput id="pw" name="password" />);
    fireEvent.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "text");
  });

  it("toggles back to type=password on second click", () => {
    render(<PasswordInput id="pw" name="password" />);
    fireEvent.click(screen.getByRole("button", { name: /mostrar contraseña/i }));
    fireEvent.click(screen.getByRole("button", { name: /ocultar contraseña/i }));
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input).toHaveAttribute("type", "password");
  });

  it("toggle button does not submit the form (type=button)", () => {
    render(<PasswordInput id="pw" name="password" />);
    expect(screen.getByRole("button", { name: /mostrar contraseña/i })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("works as a controlled input", () => {
    const onChange = jest.fn();
    render(<PasswordInput id="pw" value="secret" onChange={onChange} />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input.value).toBe("secret");
    fireEvent.change(input, { target: { value: "secret2" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("forwards name and autoComplete for server-action forms", () => {
    render(<PasswordInput id="pw" name="password" autoComplete="current-password" />);
    const input = document.getElementById("pw") as HTMLInputElement;
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
  });
});
