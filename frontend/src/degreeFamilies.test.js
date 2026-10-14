import { describe, expect, it } from "vitest";
import { branchName, foldFamilies, groupStages } from "./degreeFamilies";

describe("degree families", () => {
  it("folds branches of the same degree into one entry at the first branch's position", () => {
    const ids = ["EDU_MBA", "EDU_BTECH_CSE", "EDU_DIPLOMA_CIVIL", "EDU_BTECH_CIVIL", "EDU_BSC_CS", "EDU_BTECH_EEE"];
    const out = foldFamilies(ids, (x) => x);
    expect(out).toEqual([
      { item: "EDU_MBA" },
      { family: expect.objectContaining({ key: "btech" }), items: ["EDU_BTECH_CSE", "EDU_BTECH_CIVIL", "EDU_BTECH_EEE"] },
      { item: "EDU_DIPLOMA_CIVIL" }, // a single diploma stays a normal row
      { item: "EDU_BSC_CS" },
    ]);
  });

  it("takes the branch from English and Hindi names", () => {
    expect(branchName("B.Tech – Civil")).toBe("Civil");
    expect(branchName("बी.टेक - सिविल")).toBe("सिविल");
    expect(branchName("MBA")).toBe("MBA");
  });

  it("gives B.Tech branches their own dropdown group", () => {
    const t = (k) => ({ "family.btech": "B.Tech / B.E.", "next.level.ug": "Bachelor's" })[k] || k;
    const groups = groupStages([
      { stage_id: "EDU_BTECH_CSE", name: "B.Tech – Computer Science", level: "ug" },
      { stage_id: "EDU_BCA", name: "BCA", level: "ug" },
      { stage_id: "EDU_BTECH_CIVIL", name: "B.Tech – Civil", level: "ug" },
    ], t);
    expect(groups.map(([label, items]) => [label, items.map((s) => s.label)])).toEqual([
      ["B.Tech / B.E.", ["Computer Science", "Civil"]],
      ["Bachelor's", ["BCA"]],
    ]);
  });
});
