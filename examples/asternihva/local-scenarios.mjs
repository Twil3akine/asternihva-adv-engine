/** Local story modules are deliberately ignored by Git and excluded from npm. */
export async function loadLocalScenarios() {
  const modules = await Promise.all([
    import("../../scenario/ep00.mjs"),
    import("../../scenario/ep01.mjs"),
    import("../../scenario/ep02.mjs"),
  ]);
  return modules.map((module, index) => module[`ep${String(index).padStart(2, "0")}`]);
}
