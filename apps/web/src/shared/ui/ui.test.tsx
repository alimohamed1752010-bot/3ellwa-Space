import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, Input, ToastProvider, useToast } from ".";

describe("shared ui", () => {
  it("Button loading disables and marks busy", () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
  });
  it("Input links label, error, and aria-invalid", () => {
    render(<Input label="Name" error="Required" />);
    const i = screen.getByLabelText("Name");
    expect(i).toHaveAttribute("aria-invalid", "true");
    expect(i).toHaveAccessibleDescription("Required");
  });
  it("Toast shows a message and removes it after the timeout", async () => {
    vi.useFakeTimers();
    function Trigger() { const t = useToast(); return <button onClick={() => t.show("Saved", "success")}>go</button>; }
    render(<ToastProvider><Trigger /></ToastProvider>);
    await act(async () => { screen.getByText("go").click(); });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(4100); });
    expect(screen.queryByText("Saved")).toBeNull();
    vi.useRealTimers();
  });
});
