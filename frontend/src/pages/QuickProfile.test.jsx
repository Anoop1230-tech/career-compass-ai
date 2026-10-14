import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as api from "../services/api";
import { mockApi, renderApp } from "../test/utils";

describe("60-second profile", () => {
  it("saves name, stage, degree, branch and interests, then shows careers", async () => {
    mockApi({ loggedIn: true });
    vi.spyOn(api, "getProfileHints").mockResolvedValue({ full_name: { value: "Asha Verma", source: "email" } });
    const save = vi.spyOn(api, "saveProfile").mockResolvedValue({});
    vi.spyOn(api, "getRecommendations").mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderApp("/profile/quick");
    expect(await screen.findByRole("heading", { level: 1, name: "Your profile in 60 seconds" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Asha Verma");
    await user.selectOptions(screen.getByLabelText(/Where are you now/), "ug_student");
    await user.type(screen.getByLabelText(/degree/i), "B.Tech");
    await user.type(screen.getByLabelText(/Branch/), "Civil");
    await user.click(screen.getByRole("checkbox", { name: "Technology" }));
    await user.click(screen.getByRole("button", { name: "Show my careers" }));
    const body = save.mock.calls[0][0];
    expect(body).toMatchObject({ full_name: "Asha Verma", current_stage: "ug_student", interests: ["technology"],
      education: { degree: "B.Tech", branch: "Civil" } });
  });

  it("asks for a stream (not a degree) at school", async () => {
    mockApi({ loggedIn: true });
    const user = userEvent.setup();
    renderApp("/profile/quick");
    await user.selectOptions(await screen.findByLabelText(/Where are you now/), "class_10");
    expect(screen.getByLabelText(/^Stream/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Branch/)).not.toBeInTheDocument();
  });

  it("needs a stage before saving", async () => {
    mockApi({ loggedIn: true });
    const save = vi.spyOn(api, "saveProfile");
    const user = userEvent.setup();
    renderApp("/profile/quick");
    await user.type(await screen.findByLabelText(/Full name/), "Ravi");
    await user.click(screen.getByRole("button", { name: "Show my careers" }));
    expect(await screen.findByText("Choose where you are now.")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
});
