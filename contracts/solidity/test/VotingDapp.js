const SimpleStorage = artifacts.require("SimpleStorage");

contract("SimpleStorage", function() {
  it("should return the stored data", async function() {
    const expected = 10;
    const storage = await SimpleStorage.new();
    await storage.updateData(expected);
    const actual = await storage.readData();
    assert(
      actual.toString() === expected.toString(),
      "The data was not stored"
    );
  });
});
